
import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { Employee, AttendanceRecord, ClassGroup } from '../types';
import { LOCAL_STORAGE_KEYS } from '../constants';
import { uploadToCloudinary, getCloudinaryConfig, destroyCloudinaryImage } from './cloudinary';
import { startOfDay, endOfDay, isWithinInterval } from 'date-fns';

let supabase: SupabaseClient | null = null;

// Initialize Supabase
export const initSupabase = (url: string, key: string) => {
  if (url && key) {
    try {
      supabase = createClient(url, key);
      localStorage.setItem(LOCAL_STORAGE_KEYS.SUPABASE_URL, url);
      localStorage.setItem(LOCAL_STORAGE_KEYS.SUPABASE_KEY, key);
      return true;
    } catch (e) {
      console.error("Failed to init supabase", e);
      return false;
    }
  }
  return false;
};

export const getSupabaseClient = () => supabase;

// Helper to check if we are in "Real DB" mode or "Local Demo" mode
const isRealDb = () => !!supabase;

// Helper: Convert Base64 to Blob for upload
const base64ToBlob = async (base64: string): Promise<Blob> => {
    try {
        const res = await fetch(base64);
        return await res.blob();
    } catch (e) {
        throw new Error("Failed to process image data. Please retake the photo.");
    }
};

// Helper to map Postgres/Network error codes to human text
const mapSupabaseError = (error: any) => {
    // Network / Fetch Errors
    if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
        return "Network error: Unable to connect to the database. Please check your internet connection.";
    }

    // PostgREST / SQL Errors
    if (error.code === '23505') return "A record with this name, ID, or Student ID already exists.";
    if (error.code === '42501') return "Permission denied. Check Supabase policies (RLS).";
    if (error.code === '42703') return "Database schema mismatch. Run the SQL setup script.";
    if (error.code === '23503') return "Foreign key violation. Ensure the Class or Student ID exists.";
    if (error.code === '42P01' || error.message?.includes('schema cache')) {
        return "Database tables missing. Please run the SQL creation script in Supabase.";
    }
    if (error.code === 'PGRST116') return "Data not found or multiple rows returned unexpectedly.";

    return error.message || "An unexpected database error occurred.";
}

// --- Auth Methods ---

export const signInAdmin = async (email: string, pass: string) => {
  if (!supabase) throw new Error("Supabase not initialized");
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: pass,
    });
    
    if (error) throw error;

    return { ...data, role: 'admin' };
  } catch (error: any) {
      throw new Error(mapSupabaseError(error));
  }
};

export const signOutAdmin = async () => {
  if (!supabase) return;
  await supabase.auth.signOut();
};

export const getSession = async () => {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
};

// --- Role Management (Simplified: All Authenticated = Admin) ---

export const getCurrentUserRole = async (): Promise<string> => {
    return 'admin';
}

// --- Realtime Methods ---

export const subscribeToAttendance = (onNewRecord: (record: AttendanceRecord) => void): RealtimeChannel | null => {
  if (!supabase) return null;

  // UPDATED TABLE NAME: 'today'
  const channel = supabase
    .channel('public:today')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'today' },
      (payload) => {
        onNewRecord(payload.new as AttendanceRecord);
      }
    )
    .subscribe();

  return channel;
};

// --- Class Methods (Table: class) ---

export const getClasses = async (): Promise<ClassGroup[]> => {
    if (isRealDb() && supabase) {
        try {
            // UPDATED TABLE NAME: 'class'
            const { data, error } = await supabase.from('class').select('*').order('name', { ascending: true });
            if (error) {
                 if (error.code === '42P01') return [];
                 throw error;
            }
            return data as ClassGroup[];
        } catch (err: any) {
            console.error("Error fetching classes:", err);
            return [];
        }
    }
    return [];
};

export const addClass = async (name: string): Promise<ClassGroup> => {
    if (isRealDb() && supabase) {
        try {
            // UPDATED TABLE NAME: 'class'
            const { data, error } = await supabase.from('class').insert([{ name }]).select();
            if (error) throw error;
            return data[0] as ClassGroup;
        } catch (err: any) {
            throw new Error(mapSupabaseError(err));
        }
    }
    throw new Error("Database not connected");
};

export const deleteClass = async (id: string) => {
     if (isRealDb() && supabase) {
        // UPDATED TABLE NAME: 'class'
        const { error } = await supabase.from('class').delete().eq('id', id);
        if (error) throw error;
     }
};

// --- Employee Methods (Table: student_data) ---

export const getEmployees = async (): Promise<Employee[]> => {
  if (isRealDb() && supabase) {
    try {
        // UPDATED TABLE NAME: 'student_data'
        const { data, error } = await supabase.from('student_data').select('*').order('created_at', { ascending: false });
        if (error) {
            if (error.code === '42P01') {
                console.warn("Table 'student_data' not found.");
                return [];
            }
            throw error;
        }
        return data as Employee[];
    } catch (error: any) {
        console.error("Fetch Employees Error:", error);
        throw new Error(mapSupabaseError(error));
    }
  } else {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEYS.EMPLOYEES);
    return stored ? JSON.parse(stored) : [];
  }
};

export const addEmployee = async (employee: Omit<Employee, 'id' | 'created_at'>): Promise<Employee> => {
  
  if (!employee.student_id) {
      throw new Error("Student ID is required and must be unique.");
  }

  if (isRealDb() && supabase) {
    try {
        // Check Student ID uniqueness first (critical)
        // UPDATED TABLE NAME: 'student_data'
        const { data: existingId } = await supabase
            .from('student_data')
            .select('id')
            .eq('student_id', employee.student_id)
            .maybeSingle();
        
        if (existingId) {
            throw new Error(`Student ID ${employee.student_id} is already in use.`);
        }

        const { data: existing, error: checkError } = await supabase
          .from('student_data')
          .select('id')
          .ilike('name', employee.name)
          .eq('role', employee.role)
          .maybeSingle();
        
        if (checkError && checkError.code !== 'PGRST116') console.error("Check duplicate failed", checkError);
        if (existing) throw new Error(`${employee.name} is already registered as a ${employee.role}.`);
        
    } catch (err: any) {
        throw new Error(mapSupabaseError(err));
    }
  }

  const newId = crypto.randomUUID();
  let photoUrl = employee.photo_url;
  
  const { cloudName, uploadPreset, apiKey, apiSecret } = getCloudinaryConfig();

  if (employee.photo_base64) {
      if (cloudName && (uploadPreset || (apiKey && apiSecret))) {
          try {
              photoUrl = await uploadToCloudinary(employee.photo_base64, cloudName, uploadPreset, apiKey, apiSecret);
          } catch (err: any) {
              console.error("Cloudinary error:", err);
              throw new Error(`Image Upload Failed: ${err.message}`);
          }
      } else if (isRealDb() && supabase) {
          try {
              const blob = await base64ToBlob(employee.photo_base64);
              const fileName = `${newId}.jpg`;
              
              const { data: buckets } = await supabase.storage.listBuckets();
              const bucketExists = buckets?.find(b => b.name === 'STUDENT');
              
              if (!bucketExists) {
                   throw new Error("Storage bucket 'STUDENT' not found. Please configure Cloudinary or create the bucket in Supabase.");
              }

              const { error: uploadError } = await supabase.storage
                  .from('STUDENT')
                  .upload(fileName, blob, { contentType: 'image/jpeg', upsert: true });

              if (uploadError) throw uploadError;

              const { data: publicUrlData } = supabase.storage
                  .from('STUDENT')
                  .getPublicUrl(fileName);
              
              photoUrl = publicUrlData.publicUrl;
          } catch (err: any) {
              throw new Error(`Storage Error: ${mapSupabaseError(err)}`);
          }
      }
  }

  const newEmployee: Employee = {
    id: newId,
    name: employee.name,
    role: employee.role,
    class_id: employee.class_id,
    photo_url: photoUrl,
    photo_base64: photoUrl ? undefined : employee.photo_base64, 
    email: employee.email,
    phone: employee.phone,
    student_id: employee.student_id,
    created_at: new Date().toISOString(),
  };

  if (isRealDb() && supabase) {
    try {
        // UPDATED TABLE NAME: 'student_data'
        const { data, error } = await supabase.from('student_data').insert([newEmployee]).select();
        if (error) throw error;
        return data[0] as Employee;
    } catch (err: any) {
        throw new Error(mapSupabaseError(err));
    }
  } else {
    const current = await getEmployees();
    if (current.some(e => e.name.toLowerCase() === employee.name.toLowerCase() && e.role === employee.role)) {
        throw new Error(`${employee.name} is already registered locally.`);
    }
    const updated = [newEmployee, ...current];
    localStorage.setItem(LOCAL_STORAGE_KEYS.EMPLOYEES, JSON.stringify(updated));
    return newEmployee;
  }
};

export const deleteEmployee = async (id: string): Promise<void> => {
    if (isRealDb() && supabase) {
        try {
            // Grab the record first so we can clean up its photo
            const { data: emp } = await supabase
                .from('student_data')
                .select('photo_url')
                .eq('id', id)
                .maybeSingle();

            if (emp?.photo_url) {
                const { cloudName, apiKey, apiSecret } = getCloudinaryConfig();
                await destroyCloudinaryImage(emp.photo_url, cloudName, apiKey, apiSecret);
            }

            // Legacy fallback: Supabase Storage bucket
            const { error: storageError } = await supabase.storage.from('STUDENT').remove([`${id}.jpg`]);
            if (storageError) console.warn("Failed to delete photo:", storageError.message);
            // UPDATED TABLE NAME: 'student_data'
            const { error } = await supabase.from('student_data').delete().eq('id', id);
            if (error) throw error;
        } catch (err: any) {
            throw new Error(mapSupabaseError(err));
        }
    } else {
        const current = await getEmployees();
        const updated = current.filter(e => e.id !== id);
        localStorage.setItem(LOCAL_STORAGE_KEYS.EMPLOYEES, JSON.stringify(updated));
    }
};

// --- Attendance Methods (Table: today) ---

export const getAttendance = async (): Promise<AttendanceRecord[]> => {
    if (isRealDb() && supabase) {
        try {
            // UPDATED TABLE NAME: 'today'
            const { data, error } = await supabase.from('today').select('*').order('timestamp', { ascending: false });
            if (error) {
                if (error.code === '42P01') return []; 
                throw error;
            }
            return data as AttendanceRecord[];
        } catch (err: any) {
            throw new Error(mapSupabaseError(err));
        }
    } else {
        const stored = localStorage.getItem(LOCAL_STORAGE_KEYS.ATTENDANCE);
        return stored ? JSON.parse(stored) : [];
    }
};

export const markAttendance = async (
    studentId: string, 
    employeeName: string, 
    confidence: number,
    location?: { lat: number; lng: number }
): Promise<AttendanceRecord> => {
    
    if (!studentId) throw new Error("Cannot mark attendance: Missing Student ID.");

    // --- DAILY LIMIT LOGIC ---
    let userRecordsToday: AttendanceRecord[] = [];
    const todayStart = startOfDay(new Date()).toISOString();
    const todayEnd = endOfDay(new Date()).toISOString();

    if (isRealDb() && supabase) {
        // UPDATED TABLE NAME: 'today'
        const { data } = await supabase
            .from('today')
            .select('*')
            .eq('student_id', studentId)
            .gte('timestamp', todayStart)
            .lte('timestamp', todayEnd)
            .order('timestamp', { ascending: true });
        userRecordsToday = (data as AttendanceRecord[]) || [];
    } else {
        const allRecords = await getAttendance();
        userRecordsToday = allRecords.filter(r => 
            r.student_id === studentId && isWithinInterval(new Date(r.timestamp), { start: new Date(todayStart), end: new Date(todayEnd) })
        ).sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    }

    const checkIns = userRecordsToday.filter(r => r.type === 'check-in').length;
    const checkOuts = userRecordsToday.filter(r => r.type === 'check-out').length;

    if (checkIns >= 1 && checkOuts >= 1) {
        throw new Error("Daily Attendance Complete. You have already checked in and out today.");
    }

    let type: 'check-in' | 'check-out' = 'check-in';
    if (userRecordsToday.length > 0) {
        const lastRecord = userRecordsToday[userRecordsToday.length - 1];
        if (lastRecord.type === 'check-in') {
            type = 'check-out';
        } else {
             throw new Error("Daily Attendance Complete. You have already checked in and out today.");
        }
    }

    const newRecord: AttendanceRecord = {
        id: crypto.randomUUID(),
        student_id: studentId,
        employee_name: employeeName,
        timestamp: new Date().toISOString(),
        type,
        confidence_score: confidence,
        latitude: location?.lat,
        longitude: location?.lng
    };

    try {
        if (isRealDb() && supabase) {
            const { id, ...payload } = newRecord;
            // UPDATED TABLE NAME: 'today'
            const { data, error } = await supabase.from('today').insert([payload]).select();
            if (error) throw error;
            return data[0] as AttendanceRecord;
        } else {
            const current = await getAttendance();
            const updated = [newRecord, ...current];
            localStorage.setItem(LOCAL_STORAGE_KEYS.ATTENDANCE, JSON.stringify(updated));
            return newRecord;
        }
    } catch (err: any) {
        throw new Error(mapSupabaseError(err));
    }
};
