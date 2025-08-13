from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from pymongo import MongoClient
from bson import ObjectId
import os

# Flask app
app = Flask(__name__)
CORS(app)

# MongoDB connection
client = MongoClient("mongodb://localhost:27017/")
db = client["civic_ai"]
reports_collection = db.get_collection("reports")
users_collection = db.get_collection("users")

# Dummy AI classifier (replace with your model)
def classify_issue(image_file, category):
    # Simulate AI prediction
    from random import random, choice
    return {
        "is_match": random() > 0.2,
        "probability": round(random(), 2),
        "severity": choice(["low", "medium", "high"])
    }

# ---------- Routes ---------- #

@app.route('/')
def home():
    return "<h1>Civic AI Backend</h1><p>Use /predict to classify civic issue images or /reports to submit complaints.</p>"

@app.route('/predict', methods=['POST'])
def predict():
    image = request.files.get("image")
    category = request.form.get("category")
    if not image or not category:
        return jsonify({"error": "Missing image or category"}), 400
    result = classify_issue(image, category)
    return jsonify(result)

@app.route('/reports', methods=['POST'])
def submit_report():
    image = request.files.get("image")
    issue_type = request.form.get("type")
    location = request.form.get("location")
    description = request.form.get("description", "")
    ai_probability = request.form.get("ai_probability", "0")
    ai_severity = request.form.get("ai_severity", "")

    report = {
        "issue_type": issue_type,
        "location": location,
        "description": description,
        "ai_probability": float(ai_probability),
        "ai_severity": ai_severity,
        # You can save image if needed; skipping for now
    }
    result = reports_collection.insert_one(report)
    return jsonify({"message": "Report submitted", "id": str(result.inserted_id)}), 201

# ---------- User Authentication ---------- #

@app.route('/register', methods=['POST'])
def register():
    data = request.json
    name = data.get('name')
    email = data.get('email')
    neighborhood = data.get('neighborhood')
    password = data.get('password')

    if not name or not email or not password:
        return jsonify({'error': 'Missing required fields'}), 400

    if users_collection.find_one({'email': email}):
        return jsonify({'error': 'User already exists'}), 409

    hashed_password = generate_password_hash(password)
    user = {
        'name': name,
        'email': email,
        'neighborhood': neighborhood,
        'password': hashed_password
    }
    result = users_collection.insert_one(user)
    return jsonify({'message': 'User registered', 'id': str(result.inserted_id)}), 201

@app.route('/login', methods=['POST'])
def login():
    data = request.json
    email = data.get('email')
    password = data.get('password')

    user = users_collection.find_one({'email': email})
    if user and check_password_hash(user['password'], password):
        return jsonify({
            'message': 'Login successful',
            'user': {
                'id': str(user['_id']),
                'name': user['name'],
                'email': user['email'],
                'neighborhood': user.get('neighborhood', '')
            }
        }), 200

    return jsonify({'error': 'Invalid email or password'}), 401

# ---------- Main ---------- #
if __name__ == '__main__':
    app.run(debug=True, port=5000)
