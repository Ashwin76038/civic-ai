from flask import Flask, request, jsonify, Response
from flask_cors import CORS
import os
import cv2
import torch
import torch.nn as nn
from torchvision import models, transforms
from torchvision.models import MobileNet_V2_Weights
from dotenv import load_dotenv
from pymongo import MongoClient
from bson import json_util
import json
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Enable CORS for React frontend

# Load environment variables
load_dotenv()

# MongoDB Atlas connection
MONGO_URI = os.getenv("MONGO_URI")  # MongoDB Atlas URI from .env
client = MongoClient(MONGO_URI)
db = client.get_database('civic')  # Access default database
issues_collection = db.get_collection("issues")

# Define model categories
categories = ["drainage", "pothole", "garbage_waste"]
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# Create the binary model for each category
def create_binary_model():
    model = models.mobilenet_v2(weights=MobileNet_V2_Weights.IMAGENET1K_V1)
    for param in model.features.parameters():
        param.requires_grad = False
    for param in model.features[-2:].parameters():
        param.requires_grad = True
    model.classifier = nn.Sequential(
        nn.Linear(1280, 512),
        nn.ReLU(),
        nn.Dropout(0.4),
        nn.Linear(512, 2)
    )
    return model.to(device)

# Initialize category models
category_models = {}
base_dir = os.path.dirname(os.path.abspath(__file__))
for category in categories:
    model = create_binary_model()
    model_path = os.path.join(base_dir, f"{category}_model.pth")
    if os.path.exists(model_path):
        model.load_state_dict(torch.load(model_path, map_location=device))
        model.to(device)
        category_models[category] = model
        logger.info(f"Loaded model for {category} from {model_path}")
    else:
        logger.error(f"Warning: Model file {model_path} not found. Ensure models are trained and available.")

# Image preprocessing transform
transform = transforms.Compose([
    transforms.ToPILImage(),
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
])

@app.route('/')
def home():
    return "<h1>Civic AI Backend</h1><p>Use /predict to classify civic issue images or /reports to submit complaints.</p>"

@app.route('/predict', methods=['POST'])
def predict():
    try:
        if 'image' not in request.files or 'category' not in request.form:
            return jsonify({'error': 'Image and category are required'}), 400

        image_file = request.files['image']
        category = request.form['category']
        if category not in categories:
            return jsonify({'error': 'Invalid category'}), 400

        upload_dir = os.path.join(base_dir, 'uploads')
        os.makedirs(upload_dir, exist_ok=True)
        image_path = os.path.join(upload_dir, image_file.filename)
        image_file.save(image_path)
        logger.info(f"Saved image to {image_path}")

        # Read and preprocess
        img = cv2.imread(image_path)
        if img is None:
            raise ValueError("Failed to load image")
        img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        img_tensor = transform(img).unsqueeze(0).to(device)

        model = category_models.get(category)
        if not model:
            raise ValueError(f"Model for {category} not loaded")

        model.eval()
        with torch.no_grad():
            outputs = model(img_tensor)
            probs = torch.softmax(outputs, dim=1)
            probability = probs[0][1].item()
            is_match = probability >= 0.7

            result = {'is_match': is_match, 'probability': probability}
            if is_match:
                if probability >= 0.9:
                    result['severity'] = 'high'
                elif probability >= 0.8:
                    result['severity'] = 'medium'
                else:
                    result['severity'] = 'low'

        return jsonify(result)

    except Exception as e:
        logger.error(f"Prediction error: {e}")
        return jsonify({'error': str(e)}), 500

    finally:
        if os.path.exists(image_path):
            os.remove(image_path)
            logger.info(f"Removed temporary file {image_path}")

@app.route('/reports', methods=['POST'])
def submit_report():
    try:
        # Check for required fields
        if 'image' not in request.files:
            return jsonify({'error': 'No image provided'}), 400
        image_file = request.files['image']
        if image_file.filename == '':
            return jsonify({'error': 'No selected file'}), 400

        # Get other form fields
        issue_type = request.form.get('type')
        latitude = request.form.get('latitude')
        longitude = request.form.get('longitude')
        address = request.form.get('address', '')
        description = request.form.get('description', '')
        ai_probability = request.form.get('ai_probability', '0')
        ai_severity = request.form.get('ai_severity', '')

        # Validate required fields
        if not issue_type or not latitude or not longitude:
            return jsonify({'error': 'Type, latitude, and longitude are required'}), 400

        # Save the image
        upload_dir = os.path.join(base_dir, 'uploads')
        os.makedirs(upload_dir, exist_ok=True)
        image_path = os.path.join(upload_dir, image_file.filename)
        image_file.save(image_path)
        logger.info(f"Saved image to {image_path}")

        # Prepare report data with location as a dictionary and image filename
        report_data = {
            'type': issue_type,
            'location': {'latitude': float(latitude), 'longitude': float(longitude), 'address': address},
            'description': description,
            'ai_probability': float(ai_probability),
            'ai_severity': ai_severity,
            'image_filename': image_file.filename
        }

        # Insert into MongoDB
        result = issues_collection.insert_one(report_data)

        return jsonify({"message": "Report submitted successfully", "id": str(result.inserted_id)}), 200
    except Exception as e:
        logger.error(f"Error submitting report: {e}")
        if os.path.exists(image_path):
            os.remove(image_path)
            logger.info(f"Removed temporary file {image_path}")
        return jsonify({'error': str(e)}), 500
    finally:
        if os.path.exists(image_path):
            os.remove(image_path)
            logger.info(f"Removed temporary file {image_path}")

@app.route('/complaints', methods=['GET'])
def complaints():
    try:
        complaints = list(issues_collection.find())
        complaints_json = json_util.dumps(complaints)
        return Response(complaints_json, mimetype='application/json'), 200
    except Exception as e:
        logger.error(f"Error fetching complaints: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    if not category_models:
        logger.error("No models loaded. Please ensure model files are present.")
    else:
        logger.info("All models loaded successfully. Starting server...")
    app.run(debug=True, host='localhost', port=5000)