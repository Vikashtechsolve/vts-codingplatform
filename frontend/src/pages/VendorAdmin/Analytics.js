import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../../utils/axios';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import Modal from '../../components/Modal';
import './VendorAdminCommon.css';
import './Analytics.css';

const COLORS = ['#ED0331', '#87021C', '#28a745', '#ffc107', '#007bff', '#6c757d'];

const Analytics = () => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedClassroom, setSelectedClassroom] = useState(null);
  const [modal, setModal] = useState({ isOpen: false, title: '', content: null });

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      console.log('📥 Fetching analytics...');
      const response = await axiosInstance.get('/vendor-admin/analytics');
      console.log('✅ Analytics data received:', response.data);
      console.log('   Classrooms:', response.data.classroomAnalytics?.length || 0);
      console.log('   Total Tests:', response.data.totalTests);
      console.log('   Total Students:', response.data.totalStudents);
      setAnalytics(response.data);
    } catch (error) {
      console.error('❌ Error fetching analytics:', error);
      console.error('Error response:', error.response?.data);
    } finally {
      setLoading(false);
    }
  };

  const showStudentDetails = (classroom) => {
    setSelectedClassroom(classroom);
    setModal({
      isOpen: true,
      title: `Student Analysis - ${classroom.classroomName}`,
      content: classroom
    });
  };

  const closeModal = () => {
    setModal({ isOpen: false, title: '', content: null });
    setSelectedClassroom(null);
  };

  if (loading) {
    return <div className="loading">Loading analytics...</div>;
  }

  if (!analytics) {
    return (
      <div className="container">
        <h1 className="page-title">Analytics Dashboard</h1>
        <div className="card">
          <p>No analytics data available. Start creating tests and enrolling students to see analytics.</p>
        </div>
      </div>
    );
  }

  // Prepare chart data with safety checks
  const testPerformanceData = (analytics.testPerformance || []).map(test => ({
    name: test.testTitle && test.testTitle.length > 20 ? test.testTitle.substring(0, 20) + '...' : (test.testTitle || 'Unknown'),
    score: test.averageScore || 0,
    submissions: test.totalSubmissions || 0
  }));

  const classroomPerformanceData = (analytics.classroomAnalytics || []).map(c => ({
    name: c.classroomName && c.classroomName.length > 15 ? c.classroomName.substring(0, 15) + '...' : (c.classroomName || 'Unknown'),
    avgScore: c.averageScore || 0,
    completionRate: c.completionRate || 0
  }));

  const attemptedCount = analytics.classroomAnalytics && analytics.classroomAnalytics.length > 0
    ? new Set(analytics.classroomAnalytics.flatMap(c => (c.studentDetails || []).map(s => s.studentId))).size
    : 0;
  
  const completionData = [
    { name: 'Completed', value: analytics.totalSubmissions || 0, color: '#28a745' },
    { name: 'Not Attempted', value: Math.max(0, (analytics.totalStudents || 0) - attemptedCount), color: '#6c757d' }
  ];

  return (
    <div className="container analytics-page">
      <h1 className="page-title">Analytics Dashboard</h1>

      {/* Overall Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <h3>Total Tests</h3>
          <p className="stat-number">{analytics.totalTests || 0}</p>
        </div>
        <div className="stat-card">
          <h3>Total Students</h3>
          <p className="stat-number">{analytics.totalStudents || 0}</p>
        </div>
        <div className="stat-card">
          <h3>Total Submissions</h3>
          <p className="stat-number">{analytics.totalSubmissions || 0}</p>
        </div>
        <div className="stat-card">
          <h3>Average Score</h3>
          <p className="stat-number">{analytics.averageScore?.toFixed(1) || 0}%</p>
        </div>
        <div className="stat-card">
          <h3>Completion Rate</h3>
          <p className="stat-number">{analytics.completionRate || 0}%</p>
        </div>
        <div className="stat-card">
          <h3>Total Attempts</h3>
          <p className="stat-number">{analytics.totalAttempts || 0}</p>
        </div>
      </div>

      {/* Classroom-wise Analysis */}
      <div className="card">
        <div className="card-header">
          <h2>Classroom-wise Analysis</h2>
        </div>
        {analytics.classroomAnalytics && Array.isArray(analytics.classroomAnalytics) && analytics.classroomAnalytics.length > 0 ? (
          <div className="classrooms-grid">
            {analytics.classroomAnalytics.map((classroom) => {
              if (!classroom || !classroom.classroomId) {
                console.warn('Invalid classroom data:', classroom);
                return null;
              }
              return (
                <div 
                  key={classroom.classroomId} 
                  className="classroom-card"
                  onClick={() => showStudentDetails(classroom)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="classroom-card-header">
                    <h3>{classroom.classroomName || 'Unnamed Classroom'}</h3>
                    {classroom.description && (
                      <p className="classroom-description">{classroom.description}</p>
                    )}
                  </div>
                  <div className="classroom-stats">
                    <div className="stat-item">
                      <span className="stat-label">Total Students:</span>
                      <span className="stat-value">{classroom.totalStudents || 0}</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Attempted:</span>
                      <span className="stat-value">{classroom.attemptedCount || 0}</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Completed:</span>
                      <span className="stat-value">{classroom.completedCount || 0}</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Avg Score:</span>
                      <span className="stat-value highlight">{classroom.averageScore ? classroom.averageScore.toFixed(1) : 0}%</span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-label">Completion Rate:</span>
                      <span className="stat-value">{classroom.completionRate || 0}%</span>
                    </div>
                  </div>
                  <div className="classroom-card-footer">
                    <button className="btn btn-primary btn-sm">
                      View Details →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">📊</div>
            <h2>No Classrooms Yet</h2>
            <p>Create classrooms and add students to see detailed analytics.</p>
          </div>
        )}
      </div>

      {/* Charts Section */}
      <div className="charts-grid">
        {/* Test Performance Chart */}
        {testPerformanceData && testPerformanceData.length > 0 && (
          <div className="card chart-card">
            <div className="card-header">
              <h2>Test Performance</h2>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={testPerformanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="score" fill="#ED0331" name="Average Score (%)" />
                <Bar dataKey="submissions" fill="#87021C" name="Submissions" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Classroom Performance Chart */}
        {classroomPerformanceData && classroomPerformanceData.length > 0 && (
          <div className="card chart-card">
            <div className="card-header">
              <h2>Classroom Performance</h2>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={classroomPerformanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="avgScore" stroke="#ED0331" name="Avg Score (%)" />
                <Line type="monotone" dataKey="completionRate" stroke="#28a745" name="Completion Rate (%)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Completion Pie Chart */}
        <div className="card chart-card">
          <div className="card-header">
            <h2>Overall Completion</h2>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={completionData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {completionData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Recent Submissions */}
        {analytics.recentSubmissions && analytics.recentSubmissions.length > 0 && (
          <div className="card chart-card">
            <div className="card-header">
              <h2>Recent Submissions (Last 7 Days)</h2>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics.recentSubmissions}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#007bff" name="Submissions" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Test Performance Table */}
      <div className="card">
        <div className="card-header">
          <h2>Test Performance Details</h2>
        </div>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Test Title</th>
                <th>Submissions</th>
                <th>Average Score</th>
              </tr>
            </thead>
            <tbody>
              {analytics.testPerformance?.map((test, index) => (
                <tr key={index}>
                  <td>{test.testTitle}</td>
                  <td>{test.totalSubmissions}</td>
                  <td>{test.averageScore?.toFixed(1) || 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Student Details Modal */}
      <Modal
        isOpen={modal.isOpen}
        onClose={closeModal}
        title={modal.title}
        type="info"
      >
        {selectedClassroom && (
          <div className="student-details-modal">
            <div className="modal-stats">
              <div className="stat-box">
                <span className="stat-label">Total Students</span>
                <span className="stat-value-large">{selectedClassroom.totalStudents}</span>
              </div>
              <div className="stat-box">
                <span className="stat-label">Attempted</span>
                <span className="stat-value-large">{selectedClassroom.attemptedCount}</span>
              </div>
              <div className="stat-box">
                <span className="stat-label">Completed</span>
                <span className="stat-value-large">{selectedClassroom.completedCount}</span>
              </div>
              <div className="stat-box">
                <span className="stat-label">Avg Score</span>
                <span className="stat-value-large">{selectedClassroom.averageScore.toFixed(1)}%</span>
              </div>
            </div>

            <h3 style={{ marginTop: '20px', marginBottom: '15px' }}>Student Details</h3>
            <div className="table-container" style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Attempts</th>
                    <th>Completed</th>
                    <th>Avg Score</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedClassroom.studentDetails.map((student) => (
                    <tr key={student.studentId}>
                      <td>{student.name}</td>
                      <td>{student.email}</td>
                      <td>{student.totalAttempts}</td>
                      <td>{student.completedTests}</td>
                      <td>
                        <span className={`status-badge ${student.averageScore >= 70 ? 'active' : student.averageScore >= 50 ? 'warning' : 'inactive'}`}>
                          {student.averageScore.toFixed(1)}%
                        </span>
                      </td>
                      <td>
                        <a
                          href={`/vendor-admin/students/${student.studentId}/analysis`}
                          className="btn btn-sm btn-primary"
                          onClick={(e) => {
                            e.preventDefault();
                            window.location.href = `/vendor-admin/students/${student.studentId}/analysis`;
                          }}
                        >
                          View Analysis
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {selectedClassroom.testPerformance && selectedClassroom.testPerformance.length > 0 && (
              <>
                <h3 style={{ marginTop: '30px', marginBottom: '15px' }}>Test Performance</h3>
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Test</th>
                        <th>Submissions</th>
                        <th>Avg Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedClassroom.testPerformance.map((test, idx) => (
                        <tr key={idx}>
                          <td>{test.testTitle}</td>
                          <td>{test.submissions}</td>
                          <td>{test.averageScore.toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Analytics;
