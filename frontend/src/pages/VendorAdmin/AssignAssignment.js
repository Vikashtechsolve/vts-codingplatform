import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axiosInstance from '../../utils/axios';
import './VendorAdminCommon.css';
import './AssignTest.css';

const AssignAssignment = () => {
  const { id: assignmentId } = useParams();
  const navigate = useNavigate();
  const [assignment, setAssignment] = useState(null);
  const [students, setStudents] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [selectedClassroomId, setSelectedClassroomId] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [assignmentRes, studentsRes, classroomsRes] = await Promise.all([
        axiosInstance.get(`/assignments/${assignmentId}`),
        axiosInstance.get('/vendor-admin/students'),
        axiosInstance.get('/vendor-admin/classrooms').catch(() => ({ data: [] }))
      ]);
      if (assignmentRes.data?.success) {
        setAssignment(assignmentRes.data.assignment);
      }
      setStudents(studentsRes.data || []);
      setClassrooms(classroomsRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      alert(error.response?.data?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [assignmentId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleToggleStudent = (studentId) => {
    setSelectedClassroomId('');
    setSelectedStudents(prev =>
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const handleClassroomChange = (e) => {
    const classroomId = e.target.value;
    setSelectedClassroomId(classroomId);
    if (classroomId) {
      setSelectedStudents([]);
    }
  };

  const handleAssign = async () => {
    const hasStudents = selectedStudents.length > 0;
    const hasClassroom = !!selectedClassroomId;

    if (!hasStudents && !hasClassroom) {
      alert('Please select at least one student or a classroom');
      return;
    }

    try {
      const payload = hasClassroom
        ? { classroomId: selectedClassroomId }
        : { studentIds: selectedStudents };

      const { data } = await axiosInstance.post(`/assignments/${assignmentId}/assign`, payload);

      if (data.success) {
        alert(data.message);
        navigate('/vendor-admin/tests?type=project');
      } else {
        alert(data.message || 'Failed to assign');
      }
    } catch (error) {
      alert(error.response?.data?.message || 'Error assigning assignment');
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (!assignment) {
    return (
      <div className="container">
        <p>Assignment not found.</p>
        <button onClick={() => navigate('/vendor-admin/tests?type=project')} className="btn btn-secondary">
          Back
        </button>
      </div>
    );
  }

  if (assignment.status === 'archived') {
    return (
      <div className="container">
        <div className="error-message" style={{ marginBottom: 20 }}>
          This assignment is archived and cannot be assigned to students.
        </div>
        <button onClick={() => navigate('/vendor-admin/assignments')} className="btn btn-secondary">
          Back
        </button>
      </div>
    );
  }

  const hasSelection = selectedStudents.length > 0 || !!selectedClassroomId;

  return (
    <div className="container assign-test-page">
      <h1 className="page-title">Assign Project: {assignment.title}</h1>

      {hasSelection && (
        <div className="selected-count">
          {selectedClassroomId
            ? `Classroom selected`
            : `${selectedStudents.length} student${selectedStudents.length !== 1 ? 's' : ''} selected`}
        </div>
      )}

      <div className="assign-card-modern">
        <h2>Assign by Classroom</h2>
        <div style={{ marginBottom: 24 }}>
          <select
            value={selectedClassroomId}
            onChange={handleClassroomChange}
            style={{
              padding: '10px 16px',
              borderRadius: 8,
              minWidth: 250,
              background: 'var(--input-bg)',
              color: 'var(--text-primary)',
              border: '2px solid var(--border-color)'
            }}
          >
            <option value="">-- Select classroom (optional) --</option>
            {classrooms.map(c => (
              <option key={c._id} value={c._id}>{c.name}</option>
            ))}
          </select>
        </div>

        <h2>Or Select Students Individually</h2>
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
                      disabled={!!selectedClassroomId}
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
          <button
            onClick={handleAssign}
            className="btn btn-primary"
            disabled={!hasSelection}
          >
            Assign to {selectedClassroomId ? 'Classroom' : `Selected Students (${selectedStudents.length})`}
          </button>
          <button onClick={() => navigate('/vendor-admin/tests?type=project')} className="btn btn-secondary">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default AssignAssignment;
