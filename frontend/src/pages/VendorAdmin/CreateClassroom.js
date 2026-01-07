import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axiosInstance from '../../utils/axios';
import Modal from '../../components/Modal';
import './CreateClassroom.css';

const CreateClassroom = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  });
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'info' });

  const showModal = (title, message, type = 'info') => {
    setModal({ isOpen: true, title, message, type });
  };

  const closeModal = () => {
    setModal({ isOpen: false, title: '', message: '', type: 'info' });
  };

  React.useEffect(() => {
    if (id) {
      fetchClassroom();
    }
  }, [id]);

  const fetchClassroom = async () => {
    try {
      const response = await axiosInstance.get(`/vendor-admin/classrooms/${id}`);
      setFormData({
        name: response.data.name,
        description: response.data.description || ''
      });
    } catch (error) {
      console.error('❌ Error fetching classroom:', error);
      showModal('Error', 'Failed to load classroom data.', 'error');
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      showModal('Validation Error', 'Classroom name is required', 'error');
      return;
    }

    setLoading(true);

    try {
      if (id) {
        // Update existing classroom
        await axiosInstance.put(`/vendor-admin/classrooms/${id}`, formData);
        showModal('Success', 'Classroom updated successfully!', 'success');
      } else {
        // Create new classroom
        await axiosInstance.post('/vendor-admin/classrooms', formData);
        showModal('Success', 'Classroom created successfully!', 'success');
      }
      
      setTimeout(() => {
        navigate('/vendor-admin/classrooms');
      }, 1500);
    } catch (error) {
      console.error('❌ Error saving classroom:', error);
      const errorMsg = error.response?.data?.message || 
                       error.response?.data?.errors?.map(e => e.msg || e.message).join(', ') ||
                       'Error saving classroom. Please try again.';
      showModal('Error', errorMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container create-classroom">
      <Modal 
        isOpen={modal.isOpen} 
        onClose={closeModal}
        title={modal.title}
        type={modal.type}
      >
        <p>{modal.message}</p>
      </Modal>

      <div className="page-header">
        <h1 className="page-title">{id ? 'Edit Classroom' : 'Create Classroom'}</h1>
        <button onClick={() => navigate('/vendor-admin/classrooms')} className="btn btn-secondary">
          Back to Classrooms
        </button>
      </div>

      <div className="card">
        <form onSubmit={handleSubmit} className="classroom-form">
          <div className="form-group">
            <label>Classroom Name *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder="e.g., Batch 2024, Advanced Programming, etc."
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows="4"
              placeholder="Optional description about this classroom..."
              className="form-textarea"
            />
          </div>

          <div className="form-actions">
            <button 
              type="button" 
              onClick={() => navigate('/vendor-admin/classrooms')} 
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? (id ? 'Updating...' : 'Creating...') : (id ? 'Update Classroom' : 'Create Classroom')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateClassroom;

