
import React, { useState } from 'react';
import { Book, Database, Shield, Server, Cpu, QrCode, ScanFace, Code, Terminal, Layers, ArrowLeft, Globe, Linkedin, Github, Mail, User, Menu, X } from 'lucide-react';

interface DocsProps {
  onBack: () => void;
}

export const Docs: React.FC<DocsProps> = ({ onBack }) => {
  const [activeSection, setActiveSection] = useState('overview');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const sections = [
    { id: 'overview', label: 'System Overview', icon: Layers },
    { id: 'kiosk', label: 'Kiosk & Recognition', icon: ScanFace },
    { id: 'admin', label: 'Admin & RBAC', icon: Shield },
    { id: 'database', label: 'Database Schema', icon: Database },
    { id: 'api', label: 'API Architecture', icon: Server },
    { id: 'dev', label: 'About Developer', icon: User },
  ];

  const handleSectionClick = (id: string) => {
      setActiveSection(id);
      setIsMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen w-full max-w-7xl mx-auto px-4 sm:px-6 py-8 animate-fade-in text-content-primary">
      
      {/* Header */}
      <div className="flex justify-between items-center mb-8 gap-4 border-b border-surface-200 dark:border-white/5 pb-6">
         <div className="flex items-center gap-4">
             <button onClick={onBack} className="p-2 rounded-full hover:bg-surface-100 dark:hover:bg-white/5 transition-colors group">
                <ArrowLeft className="w-5 h-5 text-content-secondary group-hover:text-content-primary" />
             </button>
             <div>
                <h1 className="text-xl font-bold tracking-tight uppercase flex items-center gap-2">
                    <Book className="w-5 h-5 text-emerald-500" />
                    RECO_DOCS 
                </h1>
                <p className="text-[10px] text-content-secondary font-mono mt-0.5">v1.0.0 // SYSTEM MANUAL</p>
             </div>
         </div>

         {/* Mobile Menu Toggle */}
         <button 
            className="lg:hidden p-2 text-content-primary hover:bg-surface-100 dark:hover:bg-white/10 rounded-lg transition-colors"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
         >
             {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
         </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 relative">
        
        {/* Navigation Sidebar (Glassmorphism) */}
        <aside className={`
            fixed inset-y-0 left-0 z-50 w-72 bg-white/10 dark:bg-black/40 backdrop-blur-xl border-r border-white/10 shadow-[20px_0_50px_rgba(0,0,0,0.3)] p-6 transform transition-transform duration-500 lg:translate-x-0 lg:static lg:w-64 lg:bg-transparent lg:border-none lg:shadow-none lg:p-0
            ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
            <div className="lg:hidden flex justify-between items-center mb-8">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
                        <Book className="w-4 h-4 text-emerald-500" />
                    </div>
                    <h3 className="text-sm font-bold uppercase tracking-widest text-content-primary">Docs</h3>
                </div>
                <button 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-2 rounded-full hover:bg-white/10 transition-colors"
                >
                  <X className="w-5 h-5 text-content-secondary" />
                </button>
            </div>

            <p className="hidden lg:block px-4 text-[10px] font-bold uppercase tracking-[0.2em] text-content-secondary mb-4 opacity-40">Navigation</p>
            
            <nav className="space-y-1">
                {sections.map(section => (
                    <button
                        key={section.id}
                        onClick={() => handleSectionClick(section.id)}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-xs font-bold uppercase tracking-wider transition-all rounded-xl group ${activeSection === section.id 
                            ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-500' 
                            : 'text-content-secondary hover:text-content-primary hover:bg-white/5 border border-transparent'}`}
                    >
                        <section.icon className={`w-4 h-4 transition-transform group-hover:scale-110 ${activeSection === section.id ? 'text-emerald-500' : 'opacity-50'}`} />
                        {section.label}
                    </button>
                ))}
            </nav>
        </aside>

        {/* Overlay for mobile menu */}
        {isMobileMenuOpen && (
            <div className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-md" onClick={() => setIsMobileMenuOpen(false)}></div>
        )}

        {/* Content Area (Midnight Glass) */}
        <main className="flex-1 bg-white/5 dark:bg-black/30 border border-white/5 rounded-[2rem] p-6 md:p-10 shadow-2xl backdrop-blur-xl min-h-[70vh] relative overflow-hidden">
            
            {/* Ambient Glows */}
            <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500/10 rounded-full blur-[120px] -z-10 pointer-events-none animate-pulse"></div>
            <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px] -z-10 pointer-events-none animate-pulse" style={{ animationDelay: '1s' }}></div>

            {activeSection === 'overview' && (
                <div className="space-y-8 animate-fade-in">
                    <div>
                        <h2 className="text-2xl font-light mb-4 text-emerald-500 uppercase tracking-wide">Introduction</h2>
                        <p className="text-sm leading-relaxed text-content-secondary max-w-2xl">
                            RECO is a minimalist, high-performance biometric attendance system designed for educational institutions. It unifies facial recognition (powered by Gemini AI) and QR code scanning into a seamless "Kiosk" experience, managed by a robust, secure Admin Panel.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FeatureCard 
                            icon={Cpu} 
                            title="Gemini AI Engine" 
                            desc="Utilizes Google's Gemini 1.5 Flash model for analyzing facial biometrics with high confidence scores, robust to lighting variations."
                        />
                        <FeatureCard 
                            icon={QrCode} 
                            title="Instant QR" 
                            desc="Client-side optimized QR scanning (jsQR) with <50ms latency. Supports custom Student ID encoding."
                        />
                        <FeatureCard 
                            icon={Database} 
                            title="Supabase Backend" 
                            desc="Real-time PostgreSQL database with Row Level Security (RLS) ensuring data privacy and instant log updates."
                        />
                        <FeatureCard 
                            icon={Shield} 
                            title="Role-Based Access" 
                            desc="Hierarchical admin system (Super Admin vs. Sub-Admin) to delegate class management without compromising security."
                        />
                    </div>
                </div>
            )}

            {activeSection === 'kiosk' && (
                <div className="space-y-8 animate-fade-in">
                    <SectionTitle title="Kiosk Operation Mode" />
                    <p className="text-sm text-content-secondary">
                        The Kiosk is the public-facing interface intended for tablets or wall-mounted displays. It operates in two modes:
                    </p>

                    <div className="space-y-4">
                        <div className="p-4 border border-surface-200 dark:border-white/10 rounded-xl bg-surface-100 dark:bg-white/5">
                            <h3 className="text-sm font-bold uppercase tracking-wider mb-2 flex items-center gap-2 text-content-primary"><QrCode className="w-4 h-4 text-emerald-500"/> QR Mode (Default)</h3>
                            <ul className="list-disc list-inside text-xs text-content-secondary space-y-1 font-mono">
                                <li>Always active scanning loop (optimized to 500px width).</li>
                                <li>Decodes <code>student_id</code> instantly.</li>
                                <li>Ignores whitespace and performs case-insensitive lookup.</li>
                                <li>Fallback support for Legacy UUID QRs.</li>
                            </ul>
                        </div>
                        
                        <div className="p-4 border border-surface-200 dark:border-white/10 rounded-xl bg-surface-100 dark:bg-white/5">
                            <h3 className="text-sm font-bold uppercase tracking-wider mb-2 flex items-center gap-2 text-content-primary"><ScanFace className="w-4 h-4 text-blue-500"/> Face ID Mode</h3>
                            <ul className="list-disc list-inside text-xs text-content-secondary space-y-1 font-mono">
                                <li>User manually switches to Face ID.</li>
                                <li>Captures frame and sends to Gemini 2.5 Flash.</li>
                                <li>Compares against database of ~30 active candidates.</li>
                                <li>Requires high confidence score (0.8+) for authentication.</li>
                            </ul>
                        </div>
                    </div>
                </div>
            )}

            {activeSection === 'admin' && (
                <div className="space-y-8 animate-fade-in">
                    <SectionTitle title="Administrative Control" />
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <h3 className="text-xs font-bold uppercase tracking-widest mb-3 text-content-primary">Super Admin</h3>
                            <p className="text-xs text-content-secondary mb-4">Full system control. Access to global settings and admin management.</p>
                            <div className="flex flex-col gap-2">
                                <PermissionItem allowed label="Create/Delete Classes" />
                                <PermissionItem allowed label="Manage All Employees" />
                                <PermissionItem allowed label="Create Sub-Admins" />
                                <PermissionItem allowed label="Delete Database Records" />
                            </div>
                        </div>
                        <div>
                            <h3 className="text-xs font-bold uppercase tracking-widest mb-3 text-content-primary">Sub-Admin (Staff)</h3>
                            <p className="text-xs text-content-secondary mb-4">Restricted access for teachers or prefects.</p>
                            <div className="flex flex-col gap-2">
                                <PermissionItem allowed label="View Assigned Classes" />
                                <PermissionItem allowed label="Add Students" />
                                <PermissionItem allowed={false} label="Delete Classes" />
                                <PermissionItem allowed={false} label="Manage Admins" />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeSection === 'database' && (
                <div className="space-y-8 animate-fade-in">
                    <SectionTitle title="Supabase Schema" />
                    <p className="text-xs text-content-secondary mb-4">The system relies on 4 core tables. Use the SQL below to replicate the structure.</p>

                    <div className="space-y-6">
                        <CodeBlock label="public.student_data" code={`
CREATE TABLE public.student_data (
  id uuid PRIMARY KEY,
  student_id text UNIQUE NOT NULL, -- Universal Key
  name text NOT NULL,
  role text NOT NULL, -- Student, Teacher, Staff
  class_id uuid REFERENCES public.class(id),
  photo_url text, -- Cloudinary / Supabase URL
  email text,
  phone text
);`} />
                        <CodeBlock label="public.today (Attendance)" code={`
CREATE TABLE public.today (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  student_id text NOT NULL REFERENCES public.student_data(student_id),
  timestamp timestamptz DEFAULT now(),
  type text NOT NULL, -- 'check-in' | 'check-out'
  confidence_score float,
  latitude float,
  longitude float
);`} />
                        <CodeBlock label="public.class" code={`
CREATE TABLE public.class (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE -- e.g. "Class 10-A"
);`} />
                    </div>
                </div>
            )}

            {activeSection === 'api' && (
                <div className="space-y-8 animate-fade-in">
                    <SectionTitle title="API Integration" />
                    
                    <div className="space-y-4">
                        <h3 className="text-sm font-bold text-content-primary flex items-center gap-2"><Terminal className="w-4 h-4" /> Environment Variables</h3>
                        <p className="text-xs text-content-secondary">
                            The application uses <code>constants.ts</code> for hardcoded fallbacks to ensure zero-config deployment on Vercel, but supports <code>.env</code> overrides.
                        </p>
                        <div className="bg-black/50 p-4 rounded-lg border border-white/5 font-mono text-[10px] text-emerald-400 overflow-x-auto">
                            <p>VITE_SUPABASE_URL=...</p>
                            <p>VITE_SUPABASE_KEY=...</p>
                            <p>VITE_GEMINI_API_KEY=...</p>
                            <p>VITE_CLOUDINARY_CLOUD_NAME=...</p>
                        </div>
                    </div>

                    <div className="border-t border-surface-200 dark:border-white/10 pt-6">
                        <h3 className="text-sm font-bold text-content-primary mb-2">Google Gemini Integration</h3>
                        <p className="text-xs text-content-secondary leading-relaxed">
                            We use the <code>gemini-1.5-flash</code> model. The process involves:
                            <br />1. Fetching candidate images from Storage.
                            <br />2. Converting them to Base64.
                            <br />3. Sending a multi-modal prompt (Target Image + 30 Candidate Images).
                            <br />4. Parsing the JSON response for a match.
                        </p>
                    </div>
                </div>
            )}

            {activeSection === 'dev' && (
                <div className="space-y-12 animate-fade-in relative z-10">
                    <SectionTitle title="Developer Profile" />
                    
                    <div className="flex flex-col lg:flex-row items-start gap-12">
                        {/* Profile Photo Wrapper */}
                        <div className="relative group shrink-0 mx-auto lg:mx-0">
                            <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500 to-blue-500 rounded-[2.5rem] blur-2xl opacity-20 group-hover:opacity-40 transition-opacity"></div>
                            <div className="relative w-48 h-48 rounded-[2.5rem] bg-black/40 border border-white/10 p-4 shadow-2xl overflow-hidden">
                                <img 
                                    src="https://api.dicebear.com/9.x/micah/svg?seed=Aditya&backgroundColor=000000" 
                                    alt="Aditya Raj" 
                                    className="w-full h-full object-cover rounded-2xl" 
                                />
                            </div>
                        </div>
                        
                        <div className="flex-1 text-center lg:text-left space-y-6">
                            <div>
                                <h3 className="text-4xl font-bold tracking-tight text-white mb-2">Aditya Raj</h3>
                                <p className="text-emerald-500 font-mono text-sm tracking-[0.3em] uppercase">Full Stack Architect</p>
                            </div>
                            
                            <p className="text-sm text-content-secondary max-w-xl leading-relaxed font-light">
                                Specializing in the intersection of minimalist design and high-performance engineering. Creator of the RECO Ecosystem, a vision for seamless, AI-integrated institutional management.
                            </p>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md mx-auto lg:mx-0">
                                <SocialLink href="https://immortaladi.live" icon={Globe} label="Portfolio" />
                                <SocialLink href="https://linkedin.com/in/adibxr" icon={Linkedin} label="LinkedIn" />
                                <SocialLink href="https://github.com/adibxr" icon={Github} label="GitHub" />
                                <SocialLink href="mailto:devadibxr@gmail.com" icon={Mail} label="Email" />
                            </div>
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-12 border-t border-white/5">
                        <DevStat icon={Code} label="Core Stack" value="React / Supabase" color="emerald" />
                        <DevStat icon={Cpu} label="AI Engine" value="Gemini 1.5 Flash" color="blue" />
                        <DevStat icon={Layers} label="Architecture" value="Serverless SPA" color="purple" />
                    </div>
                </div>
            )}

        </main>
      </div>
    </div>
  );
};

// UI Helpers

const DevStat = ({ icon: Icon, label, value, color }: any) => (
    <div className="p-6 rounded-[1.5rem] bg-white/[0.03] border border-white/5 space-y-3">
        <div className={`w-10 h-10 rounded-xl bg-${color}-500/10 flex items-center justify-center text-${color}-500`}>
            <Icon className="w-5 h-5" />
        </div>
        <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-content-secondary mb-1">{label}</p>
            <p className="text-sm font-bold text-white">{value}</p>
        </div>
    </div>
)

const FeatureCard = ({ icon: Icon, title, desc }: any) => (
    <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-emerald-500/30 transition-all group">
        <Icon className="w-6 h-6 text-content-secondary group-hover:text-emerald-500 transition-colors mb-4" />
        <h3 className="text-sm font-bold uppercase tracking-widest mb-2 text-content-primary">{title}</h3>
        <p className="text-xs text-content-secondary leading-relaxed font-light">{desc}</p>
    </div>
)

const SectionTitle = ({ title }: { title: string }) => (
    <h2 className="text-xl font-light text-content-primary border-l-2 border-emerald-500 pl-4 uppercase tracking-widest">{title}</h2>
)

const PermissionItem = ({ label, allowed }: { label: string, allowed: boolean }) => (
    <div className="flex items-center gap-2 text-xs font-mono">
        {allowed ? <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> : <div className="w-1.5 h-1.5 rounded-full bg-red-500" />}
        <span className={allowed ? 'text-content-primary' : 'text-content-secondary opacity-50 line-through'}>{label}</span>
    </div>
)

const CodeBlock = ({ label, code }: { label: string, code: string }) => (
    <div className="rounded-lg overflow-hidden border border-surface-200 dark:border-white/10 shadow-lg">
        <div className="bg-surface-200 dark:bg-white/5 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-content-secondary border-b border-surface-300 dark:border-white/5 flex items-center justify-between">
            <span>{label}</span>
            <Database className="w-3 h-3 opacity-50" />
        </div>
        <pre className="bg-surface-900 p-4 overflow-x-auto text-[10px] font-mono text-blue-300 leading-relaxed scrollbar-hide">
            {code.trim()}
        </pre>
    </div>
)

const SocialLink = ({ href, icon: Icon, label }: any) => (
    <a 
        href={href} 
        target="_blank" 
        rel="noopener noreferrer"
        className="flex items-center justify-between gap-4 px-5 py-3 rounded-xl bg-white/[0.03] border border-white/5 text-xs font-medium text-content-secondary hover:text-white hover:bg-white/10 hover:border-white/20 transition-all group"
    >
        <div className="flex items-center gap-3">
            <Icon className="w-4 h-4 transition-transform group-hover:scale-110" />
            <span>{label}</span>
        </div>
    </a>
)
