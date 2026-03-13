import React from 'react';

const SchoolYearSelector = ({ value, onChange, required = false, disabled = false, placeholder = "Select school year" }) => {
  // Generate school years dynamically - exactly 2 years behind to 2 years ahead
  const currentYear = new Date().getFullYear();
  const schoolYears = [];
  
  for (let year = currentYear - 2; year <= currentYear + 2; year++) {
    schoolYears.push(`${year}-${year + 1}`);
  }

  return (
    <select
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      disabled={disabled}
      className="form-input"
      style={{ 
        width: '100%', 
        padding: '8px', 
        border: '1px solid #ccc', 
        borderRadius: '4px', 
        fontSize: '15px',
        backgroundColor: disabled ? '#f5f5f5' : '#fff'
      }}
    >
      <option value="">
        {placeholder}
      </option>
      {schoolYears.map(year => (
        <option key={year} value={year}>{year}</option>
      ))}
    </select>
  );
};

export default SchoolYearSelector;
