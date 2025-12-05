import React, { createContext, useContext, useState, useEffect } from 'react';
import * as api from '../services/api';

const SlipsContext = createContext();

export const SlipsProvider = ({ children }) => {
  const [slips, setSlips] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadSlips = async () => {
    setLoading(true);
    try {
      const res = await api.getAdmissionSlips();
      setSlips(res.data);
    } catch (e) {
      console.error('Failed to load slips (context):', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSlips();
  }, []);

  const updateSlipInState = (updatedSlip) => {
    setSlips(prev => prev.map(s => (s.id === updatedSlip.id ? updatedSlip : s)));
  };

  const completeSlip = async (slipId, data) => {
    const res = await api.completeForm(slipId, data);
    if (res?.data?.slip) {
      updateSlipInState(res.data.slip);
    }
    return res;
  };

  const approveSlip = async (slipId) => {
    const res = await api.approveSlip(slipId);
    if (res?.data?.slip) updateSlipInState(res.data.slip);
    return res;
  };

  const issueSlip = async (data) => {
    const res = await api.issueAdmissionSlip(data);
    if (res?.data?.slip) setSlips(prev => [res.data.slip, ...prev]);
    return res;
  };

  const deleteSlip = async (slipId) => {
    const res = await api.deleteAdmissionSlip(slipId);
    if (res?.data?.success) {
      setSlips(prev => prev.filter(s => Number(s.id) !== Number(slipId)));
    }
    return res;
  };

  return (
    <SlipsContext.Provider value={{ slips, loading, loadSlips, updateSlipInState, completeSlip, approveSlip, issueSlip, deleteSlip }}>
      {children}
    </SlipsContext.Provider>
  );
};

export const useSlips = () => useContext(SlipsContext);
