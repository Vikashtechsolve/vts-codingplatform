import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axiosInstance from '../../utils/axios';
import Modal from '../../components/Modal';
import VendorHubPage from '../../components/VendorAdmin/VendorHubPage';

const CreateClassroom = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(!!id);
  const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'info' });

  const showModal = (title, message, type = 'info') => {
    setModal({ isOpen: true, title, message, type });
  };

  const closeModal = () => {
    setModal({ isOpen: false, title: '', message: '', type: 'info' });
  };

  useEffect(() => {
    if (!id) return;
    const fetchClassroom = async () => {
      try {
        const response = await axiosInstance.get(`/vendor-admin/classrooms/${id}`);
        setFormData({
          name: response.data.name,
          description: response.data.description || '',
        });
      } catch (error) {
        console.error('Error fetching classroom:', error);
        showModal('Error', 'Failed to load classroom.', 'error');
      } finally {
        setFetching(false);
      }
    };
    fetchClassroom();
  }, [id]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      showModal('Validation', 'Classroom name is required.', 'error');
      return;
    }

    setLoading(true);

    try {
      if (id) {
        await axiosInstance.put(`/vendor-admin/classrooms/${id}`, formData);
        showModal('Saved', 'Classroom updated successfully.', 'success');
      } else {
        await axiosInstance.post('/vendor-admin/classrooms', formData);
        showModal('Created', 'Classroom created successfully.', 'success');
      }

      setTimeout(() => navigate('/vendor-admin/classrooms'), 1200);
    } catch (error) {
      const errorMsg =
        error.response?.data?.message ||
        error.response?.data?.errors?.map((e) => e.msg || e.message).join(', ') ||
        'Could not save classroom.';
      showModal('Error', errorMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <VendorHubPage
        loading
        backTo="/vendor-admin/classrooms"
        backLabel="Back to classrooms"
        accent="#0891b2"
      />
    );
  }

  return (
    <VendorHubPage
      className="vh-create-classroom"
      backTo="/vendor-admin/classrooms"
      backLabel="Back to classrooms"
      eyebrow={id ? 'Edit classroom' : 'New classroom'}
      title={id ? 'Edit classroom' : 'Create classroom'}
      subtitle="Name your batch or cohort and add an optional description for your team."
      accent="#0891b2"
    >
      <Modal isOpen={modal.isOpen} onClose={closeModal} title={modal.title} type={modal.type}>
        <p>{modal.message}</p>
      </Modal>

      <div className="vh-panel" style={{ maxWidth: 640 }}>
        <div className="vh-panel-body">
          <form className="vh-form-grid" onSubmit={handleSubmit}>
            <div className="vh-field">
              <label htmlFor="classroom-name">Classroom name *</label>
              <input
                id="classroom-name"
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                placeholder="e.g. Batch 2025, Advanced DSA"
              />
            </div>
            <div className="vh-field">
              <label htmlFor="classroom-desc">Description</label>
              <textarea
                id="classroom-desc"
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={4}
                placeholder="Optional notes about schedule, cohort, or goals…"
              />
            </div>
            <div className="vh-form-actions">
              <button
                type="button"
                className="vh-btn vh-btn--secondary"
                onClick={() => navigate('/vendor-admin/classrooms')}
              >
                Cancel
              </button>
              <button type="submit" className="vh-btn vh-btn--primary" disabled={loading}>
                {loading
                  ? id
                    ? 'Saving…'
                    : 'Creating…'
                  : id
                    ? 'Save changes'
                    : 'Create classroom'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </VendorHubPage>
  );
};

export default CreateClassroom;
