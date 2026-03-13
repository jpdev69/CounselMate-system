import React from 'react';

const TermSelector = ({ value, onChange, required = false, disabled = false }) => {
  const terms = [
    { value: '1st-term', label: '1st Term' },
    { value: '2nd-term', label: '2nd Term' },
    { value: '3rd-term', label: '3rd Term' },
    { value: 'summer', label: 'Summer' }
  ];

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
        Select term
      </option>
      {terms.map(term => (
        <option key={term.value} value={term.value}>{term.label}</option>
      ))}
    </select>
  );
};

export default TermSelector;
