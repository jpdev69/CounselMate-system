import React, { useState, useEffect } from 'react';
import api from '../services/api';

const TermSelector = ({ value, onChange, required = false, disabled = false }) => {
  const [availableTerms, setAvailableTerms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTerms = async () => {
      try {
        const response = await api.get('/visualizations/filter-options');
        setAvailableTerms(response.data.data.terms || []);
      } catch (error) {
        console.error('Error fetching terms:', error);
        // Fallback to default terms if API fails
        setAvailableTerms([
          { value: '1st', label: '1st Semester' },
          { value: '2nd', label: '2nd Semester' },
          { value: 'Summer', label: 'Summer' }
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchTerms();
  }, []);

  return (
    <select
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      disabled={disabled || loading}
      className="form-input"
      style={{ 
        width: '100%', 
        padding: '8px', 
        border: '1px solid #ccc', 
        borderRadius: '4px', 
        fontSize: '15px',
        backgroundColor: disabled || loading ? '#f5f5f5' : '#fff'
      }}
    >
      <option value="">
        {loading ? 'Loading...' : 'Select term'}
      </option>
      {!loading && availableTerms.map(term => (
        <option key={term.value} value={term.value}>{term.label}</option>
      ))}
    </select>
  );
};

export default TermSelector;
