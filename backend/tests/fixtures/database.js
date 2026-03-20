// Test data fixtures for database operations

const mockUsers = [
  {
    id: 1,
    email: 'admin@university.edu',
    full_name: 'Admin User',
    password_hash: 'admin123',
    role: 'admin',
    created_at: new Date('2024-01-01T00:00:00Z'),
    updated_at: new Date('2024-01-01T00:00:00Z')
  },
  {
    id: 2,
    email: 'counselor@example.com',
    full_name: 'Test Counselor',
    password_hash: 'password123',
    role: 'counselor',
    created_at: new Date('2024-01-02T00:00:00Z'),
    updated_at: new Date('2024-01-02T00:00:00Z')
  },
  {
    id: 3,
    email: 'newuser@gmail.com',
    full_name: 'New User',
    password_hash: 'changeme123',
    role: 'counselor',
    created_at: new Date('2024-01-15T10:00:00Z'),
    updated_at: new Date('2024-01-15T10:00:00Z')
  }
];

const mockSignupRequests = [
  {
    id: 1,
    email: 'newuser@gmail.com',
    full_name: 'New User',
    reason: 'I need access to the counseling system for my work',
    status: 'pending',
    created_at: new Date('2024-01-15T09:00:00Z'),
    updated_at: new Date('2024-01-15T09:00:00Z')
  },
  {
    id: 2,
    email: 'anotheruser@gmail.com',
    full_name: 'Another User',
    reason: 'I am a new counselor joining the team',
    status: 'approved',
    created_at: new Date('2024-01-14T14:30:00Z'),
    updated_at: new Date('2024-01-15T11:00:00Z')
  },
  {
    id: 3,
    email: 'rejecteduser@gmail.com',
    full_name: 'Rejected User',
    reason: 'Requesting access',
    status: 'rejected',
    created_at: new Date('2024-01-13T16:45:00Z'),
    updated_at: new Date('2024-01-14T09:30:00Z')
  }
];

const mockViolationTypes = [
  {
    id: 1,
    code: 'IMPROPER_UNIFORM',
    description: 'Failure to wear proper/complete uniform',
    category: 'minor',
    section_ref: '2.1.1',
    requires_admission_slip: false
  },
  {
    id: 2,
    code: 'PORNOGRAPHIC_MATERIALS',
    description: 'Possession and passing of pornographic materials',
    category: 'minor',
    section_ref: '2.1.2',
    requires_admission_slip: false
  },
  {
    id: 3,
    code: 'DRUGS_ALCOHOL_WEAPONS',
    description: 'Possession/use of alcoholic drinks, prohibited drugs, weapons or explosives',
    category: 'major',
    section_ref: '2.2.1',
    requires_admission_slip: true
  },
  {
    id: 4,
    code: 'ASSAULT_VERBAL_ABUSE',
    description: 'Assaults/physical injuries/verbal abuse',
    category: 'major',
    section_ref: '2.2.7',
    requires_admission_slip: true
  }
];

const mockAdmissionSlips = [
  {
    id: 1,
    student_name: 'John Doe',
    student_id: '2024-001',
    course: 'Bachelor of Science in Computer Science',
    year: '1st Year',
    section: 'A',
    school_year: '2024-2025',
    term: '1st Semester',
    violation_type_id: 1,
    violation_description: 'Student came to school wearing incomplete uniform',
    remarks: 'First offense',
    status: 'printed',
    created_at: new Date('2024-01-15T08:30:00Z'),
    updated_at: new Date('2024-01-15T08:30:00Z')
  },
  {
    id: 2,
    student_name: 'Jane Smith',
    student_id: '2024-002',
    course: 'Bachelor of Arts in Psychology',
    year: '2nd Year',
    section: 'B',
    school_year: '2024-2025',
    term: '1st Semester',
    violation_type_id: 3,
    violation_description: 'Student found possessing prohibited items',
    remarks: 'Serious offense - requires counseling',
    status: 'pending',
    created_at: new Date('2024-01-15T10:15:00Z'),
    updated_at: new Date('2024-01-15T10:15:00Z')
  }
];

const mockStudentReports = [
  {
    id: 1,
    student_id: 1,
    violation_type_id: 2,
    description: 'Student found sharing inappropriate materials',
    remarks: 'Counselling session scheduled',
    course: 'Bachelor of Science in Information Technology',
    school_year: '2024-2025',
    term: '1st Semester',
    year: '3rd Year',
    section: 'C',
    status: 'reported',
    created_at: new Date('2024-01-15T14:20:00Z'),
    updated_at: new Date('2024-01-15T14:20:00Z')
  }
];

const mockStudents = [
  {
    id: 1,
    student_id: '2024-001',
    first_name: 'John',
    last_name: 'Doe',
    course: 'Bachelor of Science in Computer Science',
    year: '1st Year',
    section: 'A',
    email: 'john.doe@university.edu',
    phone: '09123456789',
    created_at: new Date('2024-01-01T00:00:00Z'),
    updated_at: new Date('2024-01-01T00:00:00Z')
  },
  {
    id: 2,
    student_id: '2024-002',
    first_name: 'Jane',
    last_name: 'Smith',
    course: 'Bachelor of Arts in Psychology',
    year: '2nd Year',
    section: 'B',
    email: 'jane.smith@university.edu',
    phone: '09234567890',
    created_at: new Date('2024-01-01T00:00:00Z'),
    updated_at: new Date('2024-01-01T00:00:00Z')
  }
];

// Helper functions to set up mock database responses
const setupMockUsers = (mockPool) => {
  mockPool.query.mockImplementation((query, params) => {
    if (query.includes('SELECT') && query.includes('users')) {
      if (query.includes('WHERE email = $1')) {
        const email = params[0];
        const user = mockUsers.find(u => u.email === email);
        return Promise.resolve({ rows: user ? [user] : [] });
      }
      if (query.includes('WHERE id = $1')) {
        const id = parseInt(params[0]);
        const user = mockUsers.find(u => u.id === id);
        return Promise.resolve({ rows: user ? [user] : [] });
      }
      return Promise.resolve({ rows: mockUsers });
    }
    if (query.includes('INSERT') && query.includes('users')) {
      return Promise.resolve({ rows: [{ id: mockUsers.length + 1 }] });
    }
    if (query.includes('UPDATE') && query.includes('users')) {
      return Promise.resolve({ rows: [] });
    }
    if (query.includes('DELETE') && query.includes('users')) {
      return Promise.resolve({ rows: [] });
    }
    return Promise.resolve({ rows: [] });
  });
};

const setupMockSignupRequests = (mockPool) => {
  mockPool.query.mockImplementation((query, params) => {
    if (query.includes('SELECT') && query.includes('signup_requests')) {
      if (query.includes('WHERE email = $1')) {
        const email = params[0];
        const request = mockSignupRequests.find(r => r.email === email);
        return Promise.resolve({ rows: request ? [request] : [] });
      }
      if (query.includes('WHERE id = $1')) {
        const id = parseInt(params[0]);
        const request = mockSignupRequests.find(r => r.id === id);
        return Promise.resolve({ rows: request ? [request] : [] });
      }
      return Promise.resolve({ rows: mockSignupRequests });
    }
    if (query.includes('INSERT') && query.includes('signup_requests')) {
      return Promise.resolve({ rows: [{ id: mockSignupRequests.length + 1 }] });
    }
    if (query.includes('UPDATE') && query.includes('signup_requests')) {
      return Promise.resolve({ rows: [] });
    }
    if (query.includes('DELETE') && query.includes('signup_requests')) {
      return Promise.resolve({ rows: [] });
    }
    return Promise.resolve({ rows: [] });
  });
};

const setupMockViolationTypes = (mockPool) => {
  mockPool.query.mockImplementation((query, params) => {
    if (query.includes('SELECT') && query.includes('violation_types')) {
      if (query.includes('WHERE category = $1')) {
        const category = params[0];
        const violations = mockViolationTypes.filter(v => v.category === category);
        return Promise.resolve({ rows: violations });
      }
      return Promise.resolve({ rows: mockViolationTypes });
    }
    if (query.includes('INSERT') && query.includes('violation_types')) {
      return Promise.resolve({ rows: [{ id: mockViolationTypes.length + 1 }] });
    }
    return Promise.resolve({ rows: [] });
  });
};

const setupMockAdmissionSlips = (mockPool) => {
  mockPool.query.mockImplementation((query, params) => {
    if (query.includes('SELECT') && query.includes('admission_slips')) {
      return Promise.resolve({ rows: mockAdmissionSlips });
    }
    if (query.includes('INSERT') && query.includes('admission_slips')) {
      return Promise.resolve({ rows: [{ id: mockAdmissionSlips.length + 1 }] });
    }
    return Promise.resolve({ rows: [] });
  });
};

const setupMockStudentReports = (mockPool) => {
  mockPool.query.mockImplementation((query, params) => {
    if (query.includes('SELECT') && query.includes('student_reports')) {
      return Promise.resolve({ rows: mockStudentReports });
    }
    if (query.includes('INSERT') && query.includes('student_reports')) {
      return Promise.resolve({ rows: [{ id: mockStudentReports.length + 1 }] });
    }
    return Promise.resolve({ rows: [] });
  });
};

const setupMockStudents = (mockPool) => {
  mockPool.query.mockImplementation((query, params) => {
    if (query.includes('SELECT') && query.includes('students')) {
      if (query.includes('WHERE student_id = $1')) {
        const studentId = params[0];
        const student = mockStudents.find(s => s.student_id === studentId);
        return Promise.resolve({ rows: student ? [student] : [] });
      }
      return Promise.resolve({ rows: mockStudents });
    }
    return Promise.resolve({ rows: [] });
  });
};

// Combined setup function
const setupCompleteMockDatabase = (mockPool) => {
  mockPool.query.mockImplementation((query, params) => {
    // Users
    if (query.includes('users')) {
      if (query.includes('SELECT') && query.includes('WHERE email = $1')) {
        const email = params[0];
        const user = mockUsers.find(u => u.email === email);
        return Promise.resolve({ rows: user ? [user] : [] });
      }
      if (query.includes('SELECT') && query.includes('WHERE id = $1')) {
        const id = parseInt(params[0]);
        const user = mockUsers.find(u => u.id === id);
        return Promise.resolve({ rows: user ? [user] : [] });
      }
      if (query.includes('SELECT')) {
        return Promise.resolve({ rows: mockUsers });
      }
      if (query.includes('INSERT') || query.includes('UPDATE') || query.includes('DELETE')) {
        return Promise.resolve({ rows: [] });
      }
    }

    // Signup requests
    if (query.includes('signup_requests')) {
      if (query.includes('SELECT') && query.includes('WHERE email = $1')) {
        const email = params[0];
        const request = mockSignupRequests.find(r => r.email === email);
        return Promise.resolve({ rows: request ? [request] : [] });
      }
      if (query.includes('SELECT') && query.includes('WHERE id = $1')) {
        const id = parseInt(params[0]);
        const request = mockSignupRequests.find(r => r.id === id);
        return Promise.resolve({ rows: request ? [request] : [] });
      }
      if (query.includes('SELECT')) {
        return Promise.resolve({ rows: mockSignupRequests });
      }
      if (query.includes('INSERT') || query.includes('UPDATE') || query.includes('DELETE')) {
        return Promise.resolve({ rows: [] });
      }
    }

    // Violation types
    if (query.includes('violation_types')) {
      if (query.includes('SELECT') && query.includes('WHERE category = $1')) {
        const category = params[0];
        const violations = mockViolationTypes.filter(v => v.category === category);
        return Promise.resolve({ rows: violations });
      }
      if (query.includes('SELECT')) {
        return Promise.resolve({ rows: mockViolationTypes });
      }
      if (query.includes('INSERT')) {
        return Promise.resolve({ rows: [{ id: mockViolationTypes.length + 1 }] });
      }
    }

    // Admission slips
    if (query.includes('admission_slips')) {
      if (query.includes('SELECT')) {
        return Promise.resolve({ rows: mockAdmissionSlips });
      }
      if (query.includes('INSERT')) {
        return Promise.resolve({ rows: [{ id: mockAdmissionSlips.length + 1 }] });
      }
    }

    // Student reports
    if (query.includes('student_reports')) {
      if (query.includes('SELECT')) {
        return Promise.resolve({ rows: mockStudentReports });
      }
      if (query.includes('INSERT')) {
        return Promise.resolve({ rows: [{ id: mockStudentReports.length + 1 }] });
      }
    }

    // Students
    if (query.includes('students')) {
      if (query.includes('SELECT') && query.includes('WHERE student_id = $1')) {
        const studentId = params[0];
        const student = mockStudents.find(s => s.student_id === studentId);
        return Promise.resolve({ rows: student ? [student] : [] });
      }
      if (query.includes('SELECT')) {
        return Promise.resolve({ rows: mockStudents });
      }
    }

    // Default response
    return Promise.resolve({ rows: [] });
  });
};

module.exports = {
  mockUsers,
  mockSignupRequests,
  mockViolationTypes,
  mockAdmissionSlips,
  mockStudentReports,
  mockStudents,
  setupMockUsers,
  setupMockSignupRequests,
  setupMockViolationTypes,
  setupMockAdmissionSlips,
  setupMockStudentReports,
  setupMockStudents,
  setupCompleteMockDatabase
};
