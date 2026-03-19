import React, { useState, useEffect } from 'react';
import api from '../services/api';

const SchoolYearSelector = ({ value, onChange, required = false, disabled = false, placeholder = "Select school year" }) => {
  const [availableSchoolYears, setAvailableSchoolYears] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSchoolYears = async () => {
      try {
        const response = await api.get('/visualizations/filter-options');
        setAvailableSchoolYears(response.data.data.schoolYears || []);
      } catch (error) {
        console.error('Error fetching school years:', error);
        // Fallback to generated school years if API fails
        const currentYear = new Date().getFullYear();
        const schoolYears = [];
        for (let year = currentYear - 1; year <= currentYear + 1; year++) {
          schoolYears.push(`${year}-${year + 1}`);
        }
        setAvailableSchoolYears(schoolYears);
      } finally {
        setLoading(false);
      }
    };

    fetchSchoolYears();
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
        {loading ? 'Loading...' : placeholder}
      </option>
      {!loading && availableSchoolYears.map(year => (
        <option key={year} value={year}>{year}</option>
      ))}
    </select>
  );
};

export default SchoolYearSelector;
