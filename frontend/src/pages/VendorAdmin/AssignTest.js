import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axiosInstance from '../../utils/axios';
import './VendorAdminCommon.css';
import './AssignTest.css';

const AssignTest = () => {
  const { testId } = useParams();
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    try {
      const response = await axiosInstance.get('/vendor-admin/students');
      setStudents(response.data);
    } catch (error) {
      console.error('Error fetching students:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStudent = (studentId) => {
    setSelectedStudents(prev =>
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const handleAssign = async () => {
    if (selectedStudents.length === 0) {
      alert('Please select at least one student');
      return;
    }

    try {
      await axiosInstance.post(`/tests/${testId}/assign`, {
        studentIds: selectedStudents
      });
      alert('Test assigned successfully!');
      navigate('/vendor-admin/tests');
    } catch (error) {
      alert(error.response?.data?.message || 'Error assigning test');
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="container assign-test-page">
      <h1 className="page-title">Assign Test</h1>

      {selectedStudents.length > 0 && (
        <div className="selected-count">
          {selectedStudents.length} student{selectedStudents.length !== 1 ? 's' : ''} selected
        </div>
      )}

      <div className="assign-card-modern">
        <h2>Select Students</h2>
        <div className="table-container">
          <table className="assign-table-modern">
            <thead>
              <tr>
                <th>Select</th>
                <th>Name</th>
                <th>Email</th>
              </tr>
            </thead>
            <tbody>
              {students.map(student => (
                <tr key={student._id}>
                  <td>
                    <input
                      type="checkbox"
                      className="checkbox-modern"
                      checked={selectedStudents.includes(student._id)}
                      onChange={() => handleToggleStudent(student._id)}
                    />
                  </td>
                  <td><strong>{student.name}</strong></td>
                  <td>{student.email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="action-buttons-assign">
          <button onClick={handleAssign} className="btn btn-primary" disabled={selectedStudents.length === 0}>
            Assign Test to Selected Students ({selectedStudents.length})
          </button>
          <button onClick={() => navigate('/vendor-admin/tests')} className="btn btn-secondary">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default AssignTest;

