
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Employee, AttendanceRecord, ClassGroup } from '../types';
import { getEmployees, addEmployee, getAttendance, deleteEmployee, subscribeToAttendance, signOutAdmin, getClasses, addClass, deleteClass } from '../services/supabase';
import { LOCAL_STORAGE_KEYS, DEFAULT_CONFIG } from '../constants';
import { WebcamCapture } from './ui/WebcamCapture';
import { Trash2, Plus, X, Download, GraduationCap, BookOpen, Shield, User, Search, Mail, Phone, AlertTriangle, AlertCircle, Check, Loader2, Upload, Camera, QrCode, Folder, FolderPlus, ChevronRight, Users, ArrowLeft, ChevronDown, MapPin, Calendar, Clock, CreditCard, Settings, UserPlus, ShieldPlus, Lock, Database, UserX, Bell } from 'lucide-react';
import { format, isToday, parseISO, startOfDay } from 'date-fns';

interface AdminDashboardProps {
    onLogout: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState<'employees' | 'attendance' | 'gallery' | 'settings' | 'defaulters'>('employees');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showClassModal, setShowClassModal] = useState(false);
  
  const [search, setSearch] = useState('');
  const [showQrModal, setShowQrModal] = useState<Employee | null>(null);
  const [isDownloadingQr, setIsDownloadingQr] = useState(false);
  
  const [currentClass, setCurrentClass] = useState<ClassGroup | null>(null);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  const isSuperAdmin = true;

  const refreshData = async () => {
    setDashboardError(null);
    try {
      const [emps, atts, cls] = await Promise.all([
          getEmployees(), 
          getAttendance(), 
          getClasses()
      ]);
      setEmployees(emps);
      setRecords(atts);
      setClasses(cls.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })));
    } catch (error: any) { 
        console.error(error); 
        setDashboardError("Failed to load data. Check your internet connection or database configuration.");
    }
  };

  useEffect(() => {
    refreshData();
    const sub = subscribeToAttendance((newRecord) => {
        setRecords((prev) => [newRecord, ...prev]);
    });
    return () => { sub?.unsubscribe(); };
  }, []);

  const handleLogout = async () => {
      await signOutAdmin();
      onLogout();
  }

  const getFilteredRecords = () => {
      if (currentClass) {
          return records.filter(r => {
              const emp = employees.find(e => e.student_id === r.student_id);
              return emp?.class_id === currentClass.id;
          });
      }
      return records;
  };

  const exportCSV = () => {
    const dataToExport = getFilteredRecords();
    if (dataToExport.length === 0) {
        alert("No attendance records to export.");
        return;
    }
    const headers = ['Time', 'Name', 'Student ID', 'Role', 'Class', 'Type', 'Confidence'];
    const rows = dataToExport.map(r => {
        const emp = employees.find(e => e.student_id === r.student_id);
        const cls = classes.find(c => c.id === emp?.class_id);
        return [
            format(new Date(r.timestamp), 'yyyy-MM-dd HH:mm:ss'),
            `"${r.employee_name}"`,
            r.student_id,
            emp?.role || 'Unknown',
            cls?.name || 'Unassigned',
            r.type,
            (r.confidence_score * 100).toFixed(1) + '%'
        ]
    });
    const csv = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csv));
    link.setAttribute("download", `reco_${currentClass ? currentClass.name + '_' : ''}report_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadQrCode = async (qrData: string, name: string, studentId: string) => {
    setIsDownloadingQr(true);
    try {
        const url = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(qrData)}`;
        const response = await fetch(url);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `${name.replace(/\s+/g, '_')}_${studentId}_QR.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
    } catch (e) {
        console.error("QR Download failed", e);
        alert("Failed to download QR code.");
    } finally {
        setIsDownloadingQr(false);
    }
  };

  const handleDeleteClass = async (cls: ClassGroup) => {
      if (!confirm(`Delete Folder "${cls.name}"? Users will remain but be unassigned.`)) return;
      try {
          await deleteClass(cls.id);
          refreshData();
      } catch(e: any) {
          alert(e.message);
      }
  }

  // Memoized Stats Calculation for Performance
  const calculateStats = (studentId: string | undefined) => {
      if (!studentId) return { percentage: 0, daysPresent: 0, totalDistinctDays: 1 };
      
      const allDates = records.map(r => startOfDay(parseISO(r.timestamp)).toISOString());
      const totalDistinctDays = new Set(allDates).size || 1;
      const userDates = records
        .filter(r => r.student_id === studentId && r.type === 'check-in')
        .map(r => startOfDay(parseISO(r.timestamp)).toISOString());
      
      const daysPresent = new Set(userDates).size;
      const percentage = Math.round((daysPresent / totalDistinctDays) * 100);
      return { percentage, daysPresent, totalDistinctDays };
  }

  const getRoleIcon = (role: string) => {
      const r = role.toLowerCase();
      if (r.includes('student')) return <GraduationCap className="w-3 h-3" />;
      if (r.includes('teacher')) return <BookOpen className="w-3 h-3" />;
      if (r.includes('prefect')) return <Shield className="w-3 h-3" />;
      return <User className="w-3 h-3" />;
  }

  // Filter Employees based on Class and Search
  const filteredEmployees = useMemo(() => employees.filter(e => {
      const inClass = currentClass ? e.class_id === currentClass.id : true;
      const matchesSearch = e.name.toLowerCase().includes(search.toLowerCase()) || e.student_id?.includes(search);
      return inClass && matchesSearch;
  }), [employees, currentClass, search]);

  // Calculate Defaulters for the CURRENT context
  const defaultersList = useMemo(() => filteredEmployees.filter(e => {
      const stats = calculateStats(e.student_id);
      return stats.percentage < 75;
  }), [filteredEmployees, records]);

  // Stats Logic
  const presentToday = new Set(records.filter(r => isToday(parseISO(r.timestamp)) && r.type === 'check-in').map(r => r.student_id)).size;
  const totalUsers = employees.length;
  // Global Defaulters count (approximate based on current loaded employees)
  const globalDefaulters = useMemo(() => employees.filter(e => calculateStats(e.student_id).percentage < 75).length, [employees, records]);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-8 animate-fade-in text-content-primary">
      
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 border-b border-surface-200 dark:border-white/5 pb-6">
         <div className="flex items-center gap-4">
             <h1 className="text-xl font-bold tracking-tight uppercase">
                 ADMIN_PANEL <span className="text-content-secondary font-normal text-sm ml-2 opacity-60">v2.0.4 // SYS_ACTIVE</span>
             </h1>
         </div>
         <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1 bg-white dark:bg-white/5 rounded-full border border-surface-200 dark:border-white/10 shadow-sm">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                <span className="text-[10px] font-mono uppercase tracking-wider opacity-70">
                    ADMIN_ACCESS
                </span>
            </div>
            <button onClick={handleLogout} className="text-xs font-bold text-content-secondary hover:text-red-500 transition-colors uppercase tracking-wider">
                SIGN OUT
            </button>
         </div>
      </div>

      {dashboardError && (
          <div className="mb-6 bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-center gap-3 text-red-600 dark:text-red-500 font-mono text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <p>{dashboardError}</p>
              <button onClick={refreshData} className="ml-auto hover:underline">RETRY_CONNECTION</button>
          </div>
      )}

      {/* GLOBAL STATS (Only on Root) */}
      {!currentClass && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            <StatCard label="TOTAL USERS" value={totalUsers.toString()} subtext="Registered in DB" icon={Database} />
            <StatCard label="CLASSES" value={classes.length.toString()} subtext="Active Groups" icon={Folder} />
            <StatCard label="PRESENT TODAY" value={presentToday.toString()} subtext="Checked In" icon={Check} isHighlight />
            <StatCard label="DEFAULTERS" value={globalDefaulters.toString()} subtext="< 75% Attendance" icon={UserX} isAlert />
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-6 border-b border-surface-200 dark:border-white/5 mb-8 overflow-x-auto no-scrollbar">
         <NavBtn label="DIRECTORY" active={activeTab === 'employees'} onClick={() => setActiveTab('employees')} icon={Folder} />
         
         {/* Show Defaulters Tab ONLY when inside a class */}
         {currentClass && (
             <NavBtn 
                label={`DEFAULTERS (${defaultersList.length})`} 
                active={activeTab === 'defaulters'} 
                onClick={() => setActiveTab('defaulters')} 
                icon={UserX} 
                isAlert={defaultersList.length > 0} 
             />
         )}

         <NavBtn label="GALLERY" active={activeTab === 'gallery'} onClick={() => setActiveTab('gallery')} icon={Camera} />
         <NavBtn label="LOGS & DATA" active={activeTab === 'attendance'} onClick={() => setActiveTab('attendance')} icon={Clock} />
         <NavBtn label="SETTINGS" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={Settings} />
      </div>

      {/* Breadcrumbs */}
      {(activeTab !== 'settings') && (
        <div className="flex items-center gap-2 text-xs mb-6 font-mono text-content-secondary uppercase tracking-wider">
                <button 
                onClick={() => { setCurrentClass(null); setSearch(''); setActiveTab('employees'); }} 
                className={`hover:text-content-primary flex items-center gap-1 transition-colors ${!currentClass ? 'text-content-primary' : ''}`}
                >
                ROOT
                </button>
                {currentClass && (
                    <>
                    <ChevronRight className="w-3 h-3 opacity-50" />
                    <span className="text-content-primary">{currentClass.name}</span>
                    </>
                )}
                {search && (
                    <>
                        <ChevronRight className="w-3 h-3 opacity-50" />
                        <span>SEARCH: "{search}"</span>
                    </>
                )}
        </div>
      )}

      {/* DEFAULTERS TAB */}
      {activeTab === 'defaulters' && currentClass && (
          <div className="animate-fade-in">
              <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-6 mb-6">
                  <div className="flex items-start gap-4">
                      <div className="p-3 bg-red-500/10 rounded-full">
                          <AlertTriangle className="w-6 h-6 text-red-500" />
                      </div>
                      <div>
                          <h3 className="text-sm font-bold text-red-500 uppercase tracking-widest mb-1">Attendance Alert</h3>
                          <p className="text-xs text-content-secondary leading-relaxed max-w-2xl">
                              The following students have less than 75% attendance. 
                              According to regulations, they may be detained or require parental intervention.
                          </p>
                      </div>
                  </div>
              </div>

              {defaultersList.length === 0 ? (
                  <div className="text-center py-20 opacity-50">
                      <Check className="w-12 h-12 mx-auto mb-4 text-emerald-500" />
                      <p className="text-sm font-bold uppercase tracking-widest">All Clear</p>
                      <p className="text-xs">No students below 75% in this class.</p>
                  </div>
              ) : (
                  <div className="overflow-hidden rounded-xl border border-surface-200 dark:border-white/10 shadow-sm">
                      <table className="w-full text-left border-collapse bg-white dark:bg-surface-900/50">
                        <thead className="bg-surface-50 dark:bg-white/5 text-[10px] uppercase tracking-widest text-content-secondary">
                            <tr>
                                <th className="p-4 border-b border-surface-200 dark:border-white/5">Student</th>
                                <th className="p-4 border-b border-surface-200 dark:border-white/5">Role</th>
                                <th className="p-4 border-b border-surface-200 dark:border-white/5">Attendance Stats</th>
                                <th className="p-4 text-right border-b border-surface-200 dark:border-white/5">Status</th>
                                <th className="p-4 text-right border-b border-surface-200 dark:border-white/5">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-surface-200 dark:divide-white/5">
                            {defaultersList.map(emp => {
                                const stats = calculateStats(emp.student_id);
                                return (
                                    <tr key={emp.id} className="hover:bg-surface-50 dark:hover:bg-white/5 transition-colors">
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <img src={emp.photo_url || emp.photo_base64} className="w-8 h-8 rounded bg-surface-200 dark:bg-white/10 object-cover" />
                                                <div>
                                                    <p className="text-xs font-bold text-content-primary uppercase">{emp.name}</p>
                                                    <p className="text-[10px] text-content-secondary font-mono">{emp.student_id}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4 text-xs text-content-secondary uppercase">{emp.role}</td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <div className="text-xs font-mono text-content-primary">
                                                    {stats.daysPresent} <span className="text-content-secondary">/ {stats.totalDistinctDays} Days</span>
                                                </div>
                                            </div>
                                            <div className="w-24 h-1 bg-surface-200 dark:bg-white/10 mt-1 rounded-full overflow-hidden">
                                                <div className="h-full bg-red-500" style={{ width: `${stats.percentage}%` }}></div>
                                            </div>
                                        </td>
                                        <td className="p-4 text-right">
                                            <span className="inline-block px-2 py-1 rounded bg-red-500/10 text-red-600 dark:text-red-400 text-[10px] font-bold font-mono">
                                                {stats.percentage}% CRITICAL
                                            </span>
                                        </td>
                                        <td className="p-4 text-right">
                                            <button 
                                                className="p-2 hover:bg-surface-200 dark:hover:bg-white/10 rounded-lg transition-colors text-content-secondary hover:text-content-primary"
                                                title="Notify Parent"
                                                onClick={() => alert(`Sending notification for ${emp.name}...`)}
                                            >
                                                <Bell className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                      </table>
                  </div>
              )}
          </div>
      )}

      {/* EMPLOYEES TAB (Directory) */}
      {activeTab === 'employees' && (
        <div className="space-y-4">
           {/* Actions Bar */}
           <div className="flex flex-wrap gap-4 mb-6">
              <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-4 top-3 w-4 h-4 text-content-secondary" />
                  <input 
                    type="text" 
                    placeholder="SEARCH_DB..." 
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full bg-white dark:bg-black/40 border border-surface-200 dark:border-white/10 rounded-lg py-2.5 pl-10 pr-4 text-xs font-mono text-content-primary focus:outline-none focus:border-content-secondary transition-colors uppercase tracking-wide placeholder:opacity-50"
                  />
              </div>
              <div className="flex gap-2">
                 {!currentClass && (
                    <button 
                        onClick={() => setShowClassModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-white/5 text-content-primary rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-surface-100 dark:hover:bg-white/10 transition-colors border border-surface-200 dark:border-white/5 shadow-sm"
                    >
                        <FolderPlus className="w-4 h-4" /> New Class
                    </button>
                 )}
                 <button 
                    onClick={() => setShowAddModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-content-primary text-content-inverted rounded-lg text-xs font-bold uppercase tracking-wider hover:opacity-90 transition-opacity shadow-lg shadow-content-primary/20"
                 >
                    <Plus className="w-4 h-4" /> Add User
                 </button>
              </div>
           </div>

           {/* FOLDER GRID (Only on Root) */}
           {(!currentClass && !search) && (
               <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                   {classes.map(cls => {
                       const count = employees.filter(e => e.class_id === cls.id).length;
                       // Check if this class has any defaulters
                       const classDefaulterCount = employees.filter(e => e.class_id === cls.id && calculateStats(e.student_id).percentage < 75).length;
                       
                       return (
                           <div key={cls.id} className="group bg-white dark:bg-surface-900/50 border border-surface-200 dark:border-white/10 rounded-xl p-5 hover:border-content-secondary/50 hover:shadow-lg dark:hover:shadow-none transition-all cursor-pointer relative" onClick={() => { setCurrentClass(cls); setActiveTab('employees'); }}>
                               <div className="flex items-start justify-between mb-4">
                                   <div className="relative">
                                       <Folder className="w-8 h-8 text-content-secondary group-hover:text-content-primary transition-colors" />
                                       {classDefaulterCount > 0 && (
                                           <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white dark:border-black"></div>
                                       )}
                                   </div>
                                   {isSuperAdmin && (
                                       <button 
                                            onClick={(e) => { e.stopPropagation(); handleDeleteClass(cls); }}
                                            className="p-1.5 text-content-secondary hover:text-red-500 hover:bg-red-500/10 rounded-md transition-colors"
                                       >
                                           <Trash2 className="w-4 h-4" />
                                       </button>
                                   )}
                               </div>
                               <h3 className="font-mono text-sm font-bold text-content-primary truncate mb-1 uppercase tracking-wide">{cls.name}</h3>
                               <div className="flex items-center justify-between">
                                   <div className="flex items-center gap-2 text-[10px] text-content-secondary uppercase tracking-wider">
                                       <Users className="w-3 h-3" />
                                       <span>{count} ITEMS</span>
                                   </div>
                                   {classDefaulterCount > 0 && (
                                       <span className="text-[9px] text-red-600 dark:text-red-400 font-bold uppercase bg-red-500/10 px-1.5 py-0.5 rounded">
                                           {classDefaulterCount} Alerts
                                       </span>
                                   )}
                               </div>
                           </div>
                       )
                   })}
               </div>
           )}

           {/* EMPLOYEE LIST */}
           {(currentClass || search) && (
               <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredEmployees.map(emp => {
                        const stats = calculateStats(emp.student_id);
                        const isLow = stats.percentage < 75;
                        return (
                            <div key={emp.id} className="bg-white dark:bg-surface-900/50 border border-surface-200 dark:border-white/10 p-4 rounded-xl flex flex-col gap-4 group hover:border-content-secondary/30 hover:shadow-md dark:hover:shadow-none transition-all">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded bg-surface-200 dark:bg-white/5 overflow-hidden shrink-0 border border-black/10 dark:border-white/5 flex items-center justify-center">
                                        {(emp.photo_url || emp.photo_base64) ? (
                                            <img src={emp.photo_url || emp.photo_base64} alt={emp.name} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all" />
                                        ) : (
                                            <Shield className="w-6 h-6 text-content-secondary/30" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h4 className="text-content-primary font-bold text-sm truncate uppercase tracking-wide">{emp.name}</h4>
                                            {!(emp.photo_url || emp.photo_base64) && (
                                                <div className="px-1.5 py-0.5 rounded-full bg-content-secondary/5 border border-content-secondary/10" title="Privacy Protected: No facial data stored">
                                                    <Lock className="w-2.5 h-2.5 text-content-secondary opacity-50" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 text-content-secondary text-[10px] uppercase tracking-wider mt-1">
                                            {getRoleIcon(emp.role)}
                                            <span>{emp.role}</span>
                                        </div>
                                        {emp.student_id && (
                                            <div className="mt-1 text-[10px] text-content-secondary font-mono">
                                                ID: {emp.student_id}
                                            </div>
                                        )}
                                    </div>
                                    <div className={`text-right px-2 py-1 rounded border ${isLow ? 'bg-red-500/5 border-red-500/20 text-red-600 dark:text-red-400' : 'bg-emerald-500/5 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'}`}>
                                        <p className="text-xs font-mono font-bold">{stats.percentage}%</p>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center mt-auto pt-2 border-t border-surface-200 dark:border-white/5">
                                    <button onClick={() => setShowQrModal(emp)} className="p-1.5 rounded text-content-secondary hover:text-content-primary hover:bg-surface-100 dark:hover:bg-white/5 transition-colors" title="Generate QR">
                                        <QrCode className="w-4 h-4" />
                                    </button>
                                    <button 
                                        onClick={() => { if(confirm(`DELETE ${emp.name}?`)) deleteEmployee(emp.id).then(refreshData).catch(e => alert(e.message)) }}
                                        className="text-[10px] text-content-secondary hover:text-red-500 transition-colors uppercase tracking-widest flex items-center gap-1"
                                    >
                                        REMOVE
                                    </button>
                                </div>
                            </div>
                    )})}
                </div>
               </>
           )}
        </div>
      )}

      {/* GALLERY TAB */}
      {activeTab === 'gallery' && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filteredEmployees.map(emp => (
                <div key={emp.id} className="relative aspect-square rounded-lg overflow-hidden group bg-surface-200 dark:bg-black/50 border border-surface-200 dark:border-white/5">
                    <img src={emp.photo_url || emp.photo_base64} alt={emp.name} className="w-full h-full object-cover grayscale transition-all duration-500 group-hover:grayscale-0 group-hover:scale-105" loading="lazy" />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                        <p className="text-white text-xs font-bold uppercase tracking-wide">{emp.name}</p>
                        <p className="text-white/60 text-[10px] font-mono">{emp.student_id}</p>
                    </div>
                </div>
            ))}
        </div>
      )}

      {/* ATTENDANCE TAB */}
      {activeTab === 'attendance' && (
        <div>
            {/* Class Summary View (Root) */}
            {(!currentClass) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 animate-fade-in">
                    {classes.map(cls => {
                        const classEmpIds = employees.filter(e => e.class_id === cls.id).map(e => e.student_id).filter(Boolean) as string[];
                        const totalStudents = classEmpIds.length;
                        const presentToday = new Set(
                            records
                            .filter(r => isToday(parseISO(r.timestamp)) && r.type === 'check-in' && classEmpIds.includes(r.student_id))
                            .map(r => r.student_id)
                        ).size;
                        const percent = totalStudents > 0 ? Math.round((presentToday / totalStudents) * 100) : 0;

                        return (
                            <div key={cls.id} className="bg-white dark:bg-surface-900/50 border border-surface-200 dark:border-white/10 p-5 rounded-xl cursor-pointer hover:border-content-secondary/30 hover:shadow-md dark:hover:shadow-none transition-all group relative overflow-hidden" onClick={() => { setCurrentClass(cls); setActiveTab('attendance'); }}>
                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <p className="text-[10px] text-content-secondary uppercase tracking-widest mb-1">Class Group</p>
                                        <h3 className="font-mono text-xl font-bold text-content-primary">{cls.name}</h3>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] text-content-secondary uppercase tracking-widest mb-1">Status</p>
                                        <p className="font-mono text-lg text-emerald-500">{percent}%</p>
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-2 mb-2">
                                    <Users className="w-4 h-4 text-content-secondary" />
                                    <span className="font-mono text-sm text-content-primary">{presentToday} <span className="text-content-secondary">/ {totalStudents} present</span></span>
                                </div>

                                {/* Progress Bar */}
                                <div className="w-full h-1 bg-surface-200 dark:bg-white/5 mt-2 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${percent}%` }}></div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Detailed Logs (Class or Root) */}
            {(currentClass || (!currentClass && classes.length === 0)) && (
                <div className="animate-fade-in">
                    <div className="flex justify-between items-center mb-4">
                         <h3 className="text-xs font-bold text-content-secondary uppercase tracking-widest flex items-center gap-2">
                            <Clock className="w-3 h-3" />
                            Daily Logs {currentClass ? `// ${currentClass.name}` : ''}
                         </h3>
                         <button onClick={exportCSV} className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-content-secondary hover:text-content-primary bg-white dark:bg-white/5 px-3 py-2 rounded border border-surface-200 dark:border-white/5 hover:border-content-secondary/30 transition-all shadow-sm">
                            <Download className="w-3 h-3" /> Export CSV
                        </button>
                    </div>

                    <div className="overflow-x-auto rounded-lg border border-surface-200 dark:border-white/10 bg-white dark:bg-surface-900/50 shadow-sm">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="text-[10px] uppercase tracking-widest text-content-secondary border-b border-surface-200 dark:border-white/10 bg-surface-50 dark:bg-white/5">
                                    <th className="py-3 px-4 font-medium">User</th>
                                    <th className="py-3 px-4 font-medium">ID</th>
                                    <th className="py-3 px-4 font-medium hidden sm:table-cell">Role</th>
                                    <th className="py-3 px-4 font-medium">Action</th>
                                    <th className="py-3 px-4 font-medium">Timestamp</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm font-mono">
                                {getFilteredRecords().map(rec => {
                                    const emp = employees.find(e => e.student_id === rec.student_id);
                                    return (
                                        <tr key={rec.id} className="border-b border-surface-200 dark:border-white/5 hover:bg-surface-50 dark:hover:bg-white/[0.02] transition-colors last:border-0">
                                            <td className="py-3 px-4 text-content-primary font-bold">
                                                {rec.employee_name}
                                            </td>
                                            <td className="py-3 px-4 text-content-secondary text-xs">
                                                {rec.student_id}
                                            </td>
                                            <td className="py-3 px-4 text-content-secondary hidden sm:table-cell text-xs uppercase">
                                                {emp?.role || '-'}
                                            </td>
                                            <td className="py-3 px-4">
                                                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-bold border ${rec.type === 'check-in' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-surface-200 dark:bg-white/5 border-surface-300 dark:border-white/10 text-content-secondary'}`}>
                                                    {rec.type}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-content-secondary text-xs">
                                                {format(new Date(rec.timestamp), 'HH:mm:ss')}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && <SettingsTab />}

      {/* MODALS */}
      {showAddModal && <AddEmployeeModal classes={classes} defaultClassId={currentClass?.id} onClose={() => setShowAddModal(false)} onSuccess={() => { setShowAddModal(false); refreshData(); }} />}
      {showClassModal && <CreateClassModal onClose={() => setShowClassModal(false)} onSuccess={() => { setShowClassModal(false); refreshData(); }} />}
      
      {showQrModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-md animate-fade-in">
             <div className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-white/10 w-full max-w-sm rounded-xl overflow-hidden shadow-2xl p-6 flex flex-col items-center text-center relative">
                
                {/* ID Card Style Header */}
                <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-surface-100 dark:from-white/5 to-transparent"></div>
                
                <h3 className="relative z-10 text-xs font-bold text-content-secondary uppercase tracking-[0.2em] mb-8">Identity Verification</h3>
                
                <div className="relative z-10 flex flex-col items-center w-full">
                    {/* Centered Profile with Glow */}
                    <div className="relative mb-6">
                        <div className="absolute inset-0 bg-emerald-500/30 blur-2xl rounded-full"></div>
                        <div className="relative w-24 h-24 rounded-full p-1 bg-gradient-to-br from-white/50 to-white/20 dark:from-white/20 dark:to-white/5 border border-white/50 dark:border-white/10 shadow-lg">
                            <img src={showQrModal.photo_url || showQrModal.photo_base64} className="w-full h-full object-cover rounded-full grayscale" />
                        </div>
                    </div>

                    <h2 className="text-2xl font-bold text-content-primary uppercase tracking-tight mb-2">{showQrModal.name}</h2>
                    
                    <div className="flex items-center gap-2 mb-8">
                         <span className="text-[10px] font-bold bg-content-primary text-content-inverted px-2 py-0.5 rounded uppercase">{showQrModal.role}</span>
                         <span className="text-sm font-mono text-emerald-500 tracking-wider px-3 py-0.5 rounded-full border border-emerald-500/20 bg-emerald-500/5">{showQrModal.student_id}</span>
                    </div>

                    {/* QR Code Container */}
                    <div className="bg-white p-4 rounded-xl mb-8 shadow-xl border border-surface-200 dark:border-transparent relative group">
                        <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(showQrModal.student_id || showQrModal.id)}`} alt="QR Code" className="w-40 h-40 block mix-blend-multiply" />
                    </div>
                </div>
                
                <div className="flex gap-3 w-full relative z-10">
                    <button onClick={() => downloadQrCode(showQrModal.student_id || showQrModal.id, showQrModal.name, showQrModal.student_id!)} disabled={isDownloadingQr} className="flex-1 bg-content-primary text-content-inverted py-3 rounded-lg text-xs font-bold uppercase tracking-wider hover:opacity-90 transition-colors shadow-lg flex items-center justify-center gap-2">
                        {isDownloadingQr ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />} Download
                    </button>
                    <button onClick={() => setShowQrModal(null)} className="flex-1 bg-transparent border border-surface-300 dark:border-white/20 text-content-primary py-3 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-surface-100 dark:hover:bg-white/5 transition-colors">Close</button>
                </div>
             </div>
          </div>
      )}
    </div>
  );
};

// --- STYLED COMPONENTS ---

const StatCard = ({ label, value, subtext, icon: Icon, isHighlight, isAlert }: any) => (
    <div className={`bg-white dark:bg-surface-900/50 border p-5 rounded-xl flex items-center justify-between group transition-all shadow-sm dark:shadow-none ${isAlert ? 'border-red-500/20 bg-red-500/5' : 'border-surface-200 dark:border-white/10 hover:border-emerald-500/30 dark:hover:border-white/20'}`}>
        <div>
            <p className={`text-[10px] uppercase tracking-[0.15em] mb-1 ${isAlert ? 'text-red-600 dark:text-red-400' : 'text-content-secondary'}`}>{label}</p>
            <p className={`text-3xl font-mono font-light ${isHighlight ? 'text-emerald-600 dark:text-emerald-500' : (isAlert ? 'text-red-600 dark:text-red-500' : 'text-content-primary')}`}>{value}</p>
            {subtext && <p className={`text-[10px] mt-1 opacity-60 ${isAlert ? 'text-red-600 dark:text-red-400' : 'text-content-secondary'}`}>{subtext}</p>}
        </div>
        <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${isAlert ? 'bg-red-500/10 text-red-600 dark:text-red-500' : 'bg-surface-100 dark:bg-white/5 text-content-secondary group-hover:text-content-primary'}`}>
            <Icon className="w-5 h-5 stroke-[1.5]" />
        </div>
    </div>
)

const NavBtn = ({ label, active, onClick, icon: Icon, isAlert }: any) => (
    <button 
        onClick={onClick} 
        className={`pb-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 whitespace-nowrap flex items-center gap-2 ${active ? 'text-content-primary border-content-primary' : 'text-content-secondary border-transparent hover:text-content-primary'} ${isAlert && !active ? 'text-red-500 hover:text-red-400' : ''}`}
    >
        <Icon className={`w-4 h-4 ${isAlert ? 'text-red-500' : ''}`} />
        {label}
    </button>
)

// Reusing existing Modals but ensuring they fit the theme
const CreateClassModal: React.FC<{ onClose: () => void, onSuccess: () => void }> = ({ onClose, onSuccess }) => {
    const [name, setName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async () => {
        if(!name) return;
        setIsSubmitting(true);
        try {
            await addClass(name);
            onSuccess();
        } catch (e: any) {
            setError(e.message);
            setIsSubmitting(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-white/10 w-full max-w-md rounded-xl overflow-hidden shadow-2xl p-6">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-sm font-bold text-content-primary uppercase tracking-widest">New Class Group</h3>
                    <button onClick={onClose}><X className="w-5 h-5 text-content-secondary hover:text-content-primary" /></button>
                </div>
                {error && <p className="text-xs text-red-500 mb-4">{error}</p>}
                <Input placeholder="CLASS ID (e.g. 12A)" value={name} onChange={setName} icon={Folder} />
                <div className="flex gap-3 mt-6">
                     <button onClick={onClose} className="flex-1 py-3 text-xs font-bold uppercase text-content-secondary hover:bg-surface-100 dark:hover:bg-white/5 rounded transition-colors">Cancel</button>
                     <button onClick={handleSubmit} disabled={!name || isSubmitting} className="flex-1 bg-content-primary text-content-inverted py-3 rounded text-xs font-bold uppercase hover:opacity-90 transition-opacity shadow-lg">
                         {isSubmitting ? 'Creating...' : 'Create'}
                     </button>
                </div>
            </div>
        </div>
    )
}

const AddEmployeeModal: React.FC<{ classes: ClassGroup[], defaultClassId?: string, onClose: () => void, onSuccess: () => void }> = ({ classes, defaultClassId, onClose, onSuccess }) => {
    const [name, setName] = useState('');
    const [role, setRole] = useState('');
    const [classId, setClassId] = useState(defaultClassId || '');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [studentId, setStudentId] = useState('');
    const [photo, setPhoto] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [step, setStep] = useState(0);
    const [error, setError] = useState('');
    const [captureMethod, setCaptureMethod] = useState<'camera' | 'upload'>('upload');

    const handleSubmit = async () => {
        if (!name || !role || !studentId) return;
        setIsSubmitting(true);
        setError('');
        try {
            await addEmployee({ name, role, class_id: classId || undefined, photo_base64: photo || undefined, email, phone, student_id: studentId });
            onSuccess();
        } catch (e: any) { 
            setError(e.message || 'Failed to add user');
            setIsSubmitting(false);
        }
    }

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onloadend = () => { setPhoto(reader.result as string); };
            reader.readAsDataURL(file);
        }
    }

    const roleOptions = [
        { value: 'Student', label: 'Student', icon: GraduationCap },
        { value: 'Teacher', label: 'Teacher', icon: BookOpen },
        { value: 'Staff', label: 'Staff', icon: User },
        { value: 'Prefect', label: 'Prefect', icon: Shield }
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-white/10 w-full max-w-md rounded-xl overflow-hidden shadow-2xl">
                <div className="p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-sm font-bold text-content-primary uppercase tracking-widest">Register New User</h3>
                        <button onClick={onClose} className="text-content-secondary hover:text-content-primary"><X className="w-5 h-5" /></button>
                    </div>

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 p-3 rounded mb-4 flex gap-2 items-start">
                            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                            <p className="text-xs text-red-500 font-mono">{error}</p>
                        </div>
                    )}

                    {step === 0 ? (
                        <div className="space-y-4">
                            <Input placeholder="FULL NAME" value={name} onChange={setName} icon={User} />
                            
                            <CustomSelect 
                                value={role} 
                                onChange={setRole} 
                                placeholder="SELECT ROLE" 
                                options={roleOptions} 
                                icon={Shield} 
                            />
                            
                            <CustomSelect 
                                value={classId} 
                                onChange={setClassId} 
                                placeholder="ASSIGN CLASS" 
                                options={classes.map(c => ({ value: c.id, label: c.name, icon: Folder }))} 
                                disabled={!!defaultClassId} 
                                icon={Folder} 
                            />

                            <Input placeholder="STUDENT / STAFF ID" value={studentId} onChange={setStudentId} icon={CreditCard} />
                            <div className="grid grid-cols-2 gap-4">
                                <Input placeholder="EMAIL (OPT)" type="email" value={email} onChange={setEmail} icon={Mail} />
                                <Input placeholder="PHONE (OPT)" type="tel" value={phone} onChange={setPhone} icon={Phone} />
                            </div>
                            
                            <button disabled={!name || !role || !studentId} onClick={() => setStep(1)} className="w-full bg-content-primary text-content-inverted py-3 rounded text-xs font-bold uppercase mt-2 hover:opacity-90 disabled:opacity-50 transition-all shadow-lg">Next Step</button>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-4">
                            {!photo ? (
                                <div className="w-full">
                                    <div className="flex bg-surface-100 dark:bg-white/5 p-1 rounded mb-4">
                                        <button onClick={() => setCaptureMethod('upload')} className={`flex-1 py-2 text-[10px] font-bold uppercase rounded transition-colors ${captureMethod === 'upload' ? 'bg-white dark:bg-black text-content-primary shadow-sm' : 'text-content-secondary'}`}>Upload File</button>
                                        <button onClick={() => setCaptureMethod('camera')} className={`flex-1 py-2 text-[10px] font-bold uppercase rounded transition-colors ${captureMethod === 'camera' ? 'bg-white dark:bg-black text-content-primary shadow-sm' : 'text-content-secondary'}`}>Scan Face</button>
                                    </div>
                                    {captureMethod === 'camera' ? <WebcamCapture onCapture={setPhoto} label="Capture" /> : <div className="w-full aspect-[4/3] bg-surface-100 dark:bg-white/5 rounded border-2 border-dashed border-surface-300 dark:border-white/10 flex flex-col items-center justify-center relative hover:bg-surface-200 dark:hover:bg-white/10 transition-colors cursor-pointer group"><input type="file" accept="image/*" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer z-10" /><Upload className="w-6 h-6 text-content-secondary group-hover:text-content-primary" /><p className="text-xs text-content-secondary mt-2 uppercase tracking-wide">Select Image</p></div>}
                                    
                                    <div className="mt-4 p-4 rounded bg-surface-50 dark:bg-white/5 border border-surface-200 dark:border-white/5">
                                        <p className="text-[10px] text-content-secondary uppercase font-mono mb-2">Privacy Opt-Out</p>
                                        <p className="text-[9px] text-content-secondary mb-3 leading-tight">You can skip facial data registration. Attendance can still be marked via QR code scan.</p>
                                        <button onClick={handleSubmit} disabled={isSubmitting} className="w-full py-2 bg-transparent border border-content-secondary/30 text-content-secondary rounded text-[10px] font-bold uppercase hover:bg-surface-100 dark:hover:bg-white/10 transition-colors">
                                            {isSubmitting ? '...' : 'Skip Photo & Complete'}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="relative w-full animate-fade-in">
                                    <img src={photo} className="w-full aspect-video object-cover rounded border border-surface-200 dark:border-white/10" />
                                    <div className="absolute bottom-3 right-3 bg-emerald-500 text-white text-[10px] px-2 py-1 rounded font-bold uppercase tracking-wider flex items-center gap-1"><Check className="w-3 h-3 stroke-[3]" /> READY</div>
                                </div>
                            )}
                            <div className="flex gap-3 w-full">
                                <button onClick={() => { if (photo) { setPhoto(null); setError(''); } else { setStep(0); } }} className="flex-1 py-3 text-content-secondary hover:text-content-primary hover:bg-surface-100 dark:hover:bg-white/5 rounded transition-colors text-xs font-bold uppercase">Back</button>
                                {photo && (
                                    <button onClick={handleSubmit} disabled={isSubmitting} className="flex-1 bg-content-primary text-content-inverted py-3 rounded text-xs font-bold uppercase hover:opacity-90 disabled:opacity-50 flex justify-center items-center gap-2 shadow-lg">
                                        {isSubmitting ? '...' : 'CONFIRM REGISTRATION'}
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

// Replaced Native Select with Custom Dropdown
const CustomSelect = ({ value, onChange, options, placeholder, disabled, icon: Icon }: any) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedOption = options.find((o: any) => o.value === value);

    return (
        <div className="relative w-full group" ref={containerRef}>
             <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={`w-full flex items-center justify-between bg-white dark:bg-black/40 border border-surface-200 dark:border-white/10 rounded-lg py-3 px-4 text-left outline-none transition-all ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-content-secondary/30 active:border-content-secondary/50'}`}
             >
                <div className="flex items-center gap-3 overflow-hidden">
                    {Icon && <Icon className="w-4 h-4 text-content-secondary shrink-0" />}
                    <span className={`text-xs font-mono uppercase truncate ${selectedOption ? 'text-content-primary' : 'text-content-secondary/70'}`}>
                        {selectedOption ? selectedOption.label : placeholder}
                    </span>
                </div>
                <ChevronDown className={`w-4 h-4 text-content-secondary transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
             </button>

             {/* Dropdown Menu */}
             <div className={`absolute z-50 left-0 right-0 top-full mt-2 bg-white dark:bg-surface-900 border border-surface-200 dark:border-white/10 rounded-lg shadow-xl overflow-hidden transition-all duration-200 origin-top ${isOpen ? 'opacity-100 scale-100 visible' : 'opacity-0 scale-95 invisible'}`}>
                 <div className="max-h-48 overflow-y-auto py-1">
                     {options.map((opt: any) => (
                         <button
                            key={opt.value}
                            type="button"
                            onClick={() => { onChange(opt.value); setIsOpen(false); }}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs text-left transition-colors font-mono uppercase hover:bg-surface-50 dark:hover:bg-white/5 ${value === opt.value ? 'bg-surface-100 dark:bg-white/10 text-content-primary' : 'text-content-secondary'}`}
                         >
                            {opt.icon ? <opt.icon className="w-4 h-4 shrink-0 opacity-70" /> : (Icon && <div className="w-4 h-4" />)}
                            <span>{opt.label}</span>
                            {value === opt.value && <Check className="w-3 h-3 ml-auto text-emerald-500" />}
                         </button>
                     ))}
                 </div>
             </div>
        </div>
    );
};

const Input = ({ value, onChange, placeholder, type = "text", icon: Icon }: any) => (
    <div className="relative w-full group">
        {Icon && <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-content-secondary group-focus-within:text-content-primary transition-colors pointer-events-none" />}
        <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={`w-full bg-white dark:bg-black/40 border border-surface-200 dark:border-white/10 rounded-lg py-3 text-content-primary focus:border-content-secondary/50 outline-none text-xs font-mono placeholder:text-content-secondary/30 transition-all uppercase ${Icon ? 'pl-10' : 'pl-4'} pr-4`} />
    </div>
)

const SettingsTab = () => {
    const [cloudName, setCloudName] = useState(localStorage.getItem(LOCAL_STORAGE_KEYS.CLOUDINARY_CLOUD_NAME) || DEFAULT_CONFIG.CLOUDINARY_CLOUD_NAME);
    const [apiKey, setApiKey] = useState(localStorage.getItem(LOCAL_STORAGE_KEYS.CLOUDINARY_API_KEY) || DEFAULT_CONFIG.CLOUDINARY_API_KEY);
    const [apiSecret, setApiSecret] = useState(localStorage.getItem(LOCAL_STORAGE_KEYS.CLOUDINARY_API_SECRET) || DEFAULT_CONFIG.CLOUDINARY_API_SECRET);
    const [uploadPreset, setUploadPreset] = useState(localStorage.getItem(LOCAL_STORAGE_KEYS.CLOUDINARY_PRESET) || '');
    const [cloudUrl, setCloudUrl] = useState(localStorage.getItem(LOCAL_STORAGE_KEYS.CLOUDINARY_URL) || DEFAULT_CONFIG.CLOUDINARY_URL || '');
    const [saved, setSaved] = useState(false);

    const handleSave = () => {
        localStorage.setItem(LOCAL_STORAGE_KEYS.CLOUDINARY_CLOUD_NAME, cloudName);
        localStorage.setItem(LOCAL_STORAGE_KEYS.CLOUDINARY_API_KEY, apiKey);
        localStorage.setItem(LOCAL_STORAGE_KEYS.CLOUDINARY_API_SECRET, apiSecret);
        localStorage.setItem(LOCAL_STORAGE_KEYS.CLOUDINARY_PRESET, uploadPreset);
        localStorage.setItem(LOCAL_STORAGE_KEYS.CLOUDINARY_URL, cloudUrl);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
    }

    return (
        <div className="max-w-2xl mx-auto py-10 animate-fade-in">
            <div className="bg-white dark:bg-surface-900 border border-surface-200 dark:border-white/10 rounded-2xl p-8 shadow-xl">
                <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20">
                        <Settings className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold uppercase tracking-tight">System Configuration</h2>
                        <p className="text-xs text-content-secondary uppercase font-mono tracking-widest opacity-60">Media Storage // Cloudinary API</p>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="grid gap-4">
                        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-content-secondary ml-1">Cloud Name</label>
                        <Input value={cloudName} onChange={setCloudName} placeholder="CLOUDINARY_CLOUD_NAME" icon={Database} />
                    </div>

                    <div className="grid gap-4">
                        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-content-secondary ml-1">API Key</label>
                        <Input value={apiKey} onChange={setApiKey} placeholder="CLOUDINARY_API_KEY" icon={Lock} />
                    </div>

                    <div className="grid gap-4">
                        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-content-secondary ml-1">API Secret</label>
                        <Input value={apiSecret} onChange={setApiSecret} type="password" placeholder="CLOUDINARY_API_SECRET" icon={Shield} />
                    </div>

                    <div className="grid gap-4">
                        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-content-secondary ml-1">Upload Preset (Optional)</label>
                        <Input value={uploadPreset} onChange={setUploadPreset} placeholder="UNSIGNED_PRESET_NAME" icon={Upload} />
                        <p className="text-[9px] text-content-secondary opacity-50 px-1 italic">Use this if you prefer unsigned uploads without API secrets.</p>
                    </div>

                    <div className="grid gap-4">
                        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-content-secondary ml-1">Cloudinary URL (Optional)</label>
                        <Input value={cloudUrl} onChange={setCloudUrl} placeholder="cloudinary://API_KEY:API_SECRET@CLOUD_NAME" icon={Upload} />
                        <p className="text-[9px] text-content-secondary opacity-50 px-1 italic">Filled automatically from system defaults. Overrides Cloud Name / API Key / API Secret above.</p>
                    </div>

                    <button 
                        onClick={handleSave}
                        className="w-full bg-content-primary text-content-inverted py-4 rounded-xl font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-lg mt-4 group"
                    >
                        {saved ? (
                            <><Check className="w-4 h-4 text-emerald-400" /> Settings Saved</>
                        ) : (
                            <>Save Configuration</>
                        )}
                    </button>
                </div>
            </div>

            <div className="mt-8 bg-surface-100 dark:bg-white/5 border border-surface-200 dark:border-white/10 rounded-xl p-6 flex items-start gap-4">
                <AlertCircle className="w-5 h-5 text-content-secondary shrink-0 mt-0.5" />
                <div className="text-[10px] leading-relaxed uppercase tracking-widest font-mono text-content-secondary opacity-80">
                    <p className="mb-2 text-content-primary font-bold">Configuration Note:</p>
                    These settings are stored locally in your browser and will override the default system values. 
                    Ensure your Cloudinary account is active to prevent image upload failures during registration.
                </div>
            </div>
        </div>
    )
}
