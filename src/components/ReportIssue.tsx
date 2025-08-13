import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, Upload, MapPin, AlertTriangle, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Webcam from 'react-webcam';
import GoogleMapComponent from './GoogleMapComponent'; // Updated with Leaflet/OSM

interface AIAnalysis {
  is_match: boolean;
  probability: number;
  severity?: 'low' | 'medium' | 'high';
}

type IssueType = 'drainage' | 'garbage_waste' | 'pothole';

const ReportIssue: React.FC = () => {
  const navigate = useNavigate();
  const webcamRef = useRef<Webcam>(null);
  const [image, setImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState('');
  const [description, setDescription] = useState('');
  const [issueType, setIssueType] = useState<IssueType>('drainage');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const analyzeImage = useCallback(async (imageData: File, category: IssueType) => {
    setIsAnalyzing(true);
    try {
      const formData = new FormData();
      formData.append('image', imageData);
      formData.append('category', category);
      const response = await fetch('/predict', {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) throw new Error('Failed to analyze image');
      const result: AIAnalysis = await response.json();
      setAiAnalysis(result);
      if (result.is_match) {
        toast.success(
          `Confirmed: This is a ${category} with ${(result.probability * 100).toFixed(1)}% confidence.`,
          { duration: 5000 }
        );
      } else {
        toast.error(
          `This does not appear to be a ${category} (${(result.probability * 100).toFixed(1)}% confidence).`,
          { duration: 5000 }
        );
      }
    } catch (error: any) {
      console.error('Analysis error:', error);
      toast.error(`Failed to analyze image: ${error.message || 'Unknown error'}`);
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImage(file);
      setPreviewUrl(URL.createObjectURL(file));
      setAiAnalysis(null);
    }
  };

  const handleScan = () => {
    if (image && issueType) {
      analyzeImage(image, issueType);
    } else {
      toast.error('Please upload or capture an image and select a category');
    }
  };

  const capture = useCallback(async () => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        setPreviewUrl(imageSrc);
        setShowCamera(false);
        const response = await fetch(imageSrc);
        const blob = await response.blob();
        const file = new File([blob], 'camera-capture.jpg', { type: 'image/jpeg' });
        setImage(file);
        setAiAnalysis(null);
      } else {
        toast.error('Failed to capture image');
      }
    }
  }, []);

  const handleLocationSelect = useCallback(async (coords: { lat: number; lng: number }) => {
    setLocation(coords);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.lat}&lon=${coords.lng}&zoom=18&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'CivicIssueReporter/1.0' // Required for Nominatim policy
          }
        }
      );
      const data = await response.json();
      if (data && data.display_name) {
        setAddress(data.display_name);
      } else {
        setAddress('Address not found');
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      toast.error('Failed to fetch address');
      setAddress('');
    }
  }, []);

  const handleSubmit = async () => {
    if (!image) {
      toast.error('Please upload or capture an image');
      return;
    }
    if (!location) {
      toast.error('Please select a location on the map');
      return;
    }
    if (!aiAnalysis) {
      toast.error('Please scan the image to confirm the issue');
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('image', image);
      formData.append('type', issueType);
      formData.append('latitude', location.lat.toString());
      formData.append('longitude', location.lng.toString());
      formData.append('address', address);
      formData.append('description', description);
      if (aiAnalysis.is_match) {
        formData.append('ai_probability', aiAnalysis.probability.toString());
        formData.append('ai_severity', aiAnalysis.severity || '');
      } else {
        formData.append('ai_probability', '0');
      }

      // Log form data for debugging
      for (let [key, value] of formData.entries()) {
        console.log(key, value);
      }

      const response = await fetch('/reports', {
        method: 'POST',
        body: formData
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to submit report: ${errorText || 'Unknown error'}`);
      }
      toast.success('Report submitted successfully!');
      // setTimeout(() => navigate('/my-reports'), 2000);
    } catch (error: any) {
      console.error('Submit error:', error);
      toast.error(`Failed to submit report: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center">
          <Camera className="mx-auto h-12 w-12 text-blue-600" aria-hidden="true" />
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">Report an Issue</h2>
          <p className="mt-2 text-sm text-gray-600">
            Select a category, capture or upload a photo, select location on map, and scan to confirm
          </p>
        </div>

        <div className="mt-8 space-y-6">
          <div>
            <label htmlFor="issue-type" className="block text-sm font-medium text-gray-700">
              Select Issue Type
            </label>
            <select
              id="issue-type"
              value={issueType}
              onChange={(e) => setIssueType(e.target.value as IssueType)}
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
              aria-label="Select issue type"
            >
              <option value="drainage">Drainage</option>
              <option value="garbage_waste">Garbage Waste</option>
              <option value="pothole">Pothole</option>
            </select>
          </div>

          <div className="space-y-4">
            <div className="flex justify-center space-x-4">
              <button
                type="button"
                onClick={() => setShowCamera(!showCamera)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-400"
                disabled={isAnalyzing || isSubmitting}
                aria-label={showCamera ? 'Hide camera' : 'Use camera'}
              >
                {showCamera ? 'Hide Camera' : 'Use Camera'}
                <Camera className="ml-2 h-4 w-4" aria-hidden="true" />
              </button>
              <label
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-blue-600 bg-blue-100 hover:bg-blue-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                aria-label="Upload image"
              >
                Upload Image
                <Upload className="ml-2 h-4 w-4" aria-hidden="true" />
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleImageChange}
                  disabled={isAnalyzing || isSubmitting}
                />
              </label>
            </div>

            {showCamera && (
              <div className="relative">
                <Webcam
                  ref={webcamRef}
                  screenshotFormat="image/jpeg"
                  className="w-full rounded-lg"
                  videoConstraints={{ facingMode: 'environment' }}
                />
                <button
                  type="button"
                  onClick={capture}
                  className="absolute bottom-4 left-1/2 transform -translate-x-1/2 px-4 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  aria-label="Capture photo"
                >
                  Capture Photo
                </button>
              </div>
            )}

            {previewUrl && !showCamera && (
              <div className="relative">
                <img
                  src={previewUrl}
                  alt="Issue preview"
                  className="w-full h-64 object-cover rounded-lg"
                />
                <div className="mt-4 flex justify-center">
                  <button
                    type="button"
                    onClick={handleScan}
                    disabled={isAnalyzing || isSubmitting}
                    className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white ${
                      isAnalyzing || isSubmitting
                        ? 'bg-blue-400 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700'
                    } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
                    aria-label="Scan image"
                  >
                    {isAnalyzing ? 'Scanning...' : 'Scan Image'}
                    {isAnalyzing ? (
                      <RefreshCw className="ml-2 h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <AlertTriangle className="ml-2 h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
                {aiAnalysis && (
                  <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-4">
                    <h3 className="font-semibold text-gray-900">AI Analysis for {issueType.replace('_', ' ')}</h3>
                    {aiAnalysis.is_match ? (
                      aiAnalysis.probability >= 0.7 ? (
                        <p className="text-sm text-green-600">
                          Confirmed: This is a {issueType.replace('_', ' ')} with {(aiAnalysis.probability * 100).toFixed(1)}% confidence. Severity: {aiAnalysis.severity}
                        </p>
                      ) : (
                        <p className="text-sm text-yellow-600">
                          Possible {issueType.replace('_', ' ')}, but the image is unclear ({(aiAnalysis.probability * 100).toFixed(1)}% confidence). Please upload a clearer photo.
                        </p>
                      )
                    ) : (
                      <p className="text-sm text-red-600">
                        This does not appear to be a {issueType.replace('_', ' ')} ({(aiAnalysis.probability * 100).toFixed(1)}% confidence).
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Select Location
            </label>
            <div className="mt-1">
              <GoogleMapComponent
                onLocationSelect={handleLocationSelect}
                initialLocation={location}
              />
            </div>
            {address && (
              <div className="mt-2 flex items-center">
                <MapPin className="h-5 w-5 text-gray-400 mr-2" aria-hidden="true" />
                <p className="text-sm text-gray-600">{address}</p>
              </div>
            )}
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700">
              Additional Details
            </label>
            <div className="mt-1">
              <textarea
                id="description"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                placeholder="Provide any additional details about the issue"
                disabled={isSubmitting}
                aria-label="Issue description"
              />
            </div>
          </div>

          <div>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                isSubmitting
                  ? 'bg-blue-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700'
              } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
              aria-label="Submit report"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Report'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportIssue;