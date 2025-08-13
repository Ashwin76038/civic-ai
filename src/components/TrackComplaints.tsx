import React, { useEffect, useState } from "react";
import axios from "axios";

interface Complaint {
  _id?: { $oid: string } | string;
  title?: string;
  description?: string;
  status?: string;
  imageUrl?: string; // complaint image
  location?: {
    latitude?: number;
    longitude?: number;
    address?: string;
  };
}

const statusColors: Record<string, string> = {
  Open: "bg-yellow-100 text-yellow-800",
  "In Progress": "bg-blue-100 text-blue-800",
  Resolved: "bg-green-100 text-green-800",
  Closed: "bg-gray-100 text-gray-800",
};

const TrackComplaints: React.FC = () => {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios
      .get("http://localhost:5000/complaints")
      .then((res) => {
        console.log("Fetched complaints:", res.data);
        setComplaints(Array.isArray(res.data) ? res.data : []);
      })
      .catch((err) => {
        console.error("Error fetching complaints:", err);
        setComplaints([]);
      })
      .then(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen text-gray-600">
        Loading complaints...
      </div>
    );
  }

  if (!complaints.length) {
    return (
      <div className="flex justify-center items-center min-h-screen text-gray-500">
        No complaints found.
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Track Complaints</h2>
      <div className="grid gap-4">
        {complaints.map((complaint, index) => {
          const id =
            typeof complaint._id === "object"
              ? complaint._id?.$oid
              : complaint._id;

          const statusClass =
            statusColors[complaint.status || ""] || "bg-gray-100 text-gray-800";

          return (
            <div
              key={id || Math.random()}
              className="p-5 bg-white rounded-xl shadow hover:shadow-lg transition-all duration-200"
            >
              <div className="flex justify-between items-start">
                <h3 className="text-lg font-semibold">
                  {complaint.title || `Complaint ${index + 1}`}
                </h3>

                {complaint.imageUrl ? (
                  <img
                    src={complaint.imageUrl}
                    alt={`Complaint ${index + 1}`}
                    className="w-16 h-16 object-cover rounded-md border"
                  />
                ) : (
                  <div className={`px-3 py-1 text-xs font-medium rounded-full ${statusClass}`}>
                    {complaint.status || ""}
                  </div>
                )}
              </div>

              <p className="text-gray-600 mt-2">
                {complaint.description || "No description provided"}
              </p>

              {complaint.location ? (
                <div className="mt-3 text-sm text-gray-700">
                  <p>
                    📍 <strong>Address:</strong>{" "}
                    {complaint.location.address || "N/A"}
                  </p>
                  <p>
                    🗺{" "}
                    <a
                      href={`https://www.google.com/maps?q=${complaint.location.latitude},${complaint.location.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      View on Google Maps
                    </a>
                  </p>
                </div>
              ) : (
                <p className="mt-3 text-sm text-gray-500">No location data</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TrackComplaints;
