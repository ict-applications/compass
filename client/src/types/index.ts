export interface User {
  id: number;
  email: string;
  name: string;
  role: 'admin' | 'user';
}

export interface Category {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface Brand {
  id: number;
  name: string;
  property_count: number;
  created_at: string;
  updated_at: string;
}

export interface Property {
  id: number;
  name: string;
  brand_id: number | null;
  brand_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserWithProperties {
  id: number;
  login: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  created_at: string;
  properties: string[];
}

export interface SopDocument {
  id: number;
  title: string;
  description: string | null;
  category: string | null;
  brand: string | null;
  property: string | null;
  version: string;
  filename: string;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface SopPreview extends SopDocument {
  preview: string;
}

export interface MatchedSection {
  sop_section: string;
  document_excerpt: string;
  compliance_level: 'full' | 'partial';
  notes: string;
}

export interface Gap {
  severity: 'critical' | 'major' | 'minor';
  sop_requirement: string;
  current_status: string;
  gap_description: string;
  document_section: string;
}

export interface Recommendation {
  priority: 'high' | 'medium' | 'low';
  section: string;
  action: string;
  suggested_language?: string;
}

export interface ComparisonReport {
  id: number;
  user_id: number;
  submitted_filename: string;
  submitted_filepath: string;
  submitted_text: string | null;
  sop_id: number;
  sop_title: string;
  sop_category: string | null;
  sop_version: string;
  status: 'pending' | 'processing' | 'complete' | 'error';
  compliance_score: number | null;
  summary: string | null;
  gaps: Gap[];
  recommendations: Recommendation[];
  matched_sections: MatchedSection[];
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
  overall_assessment?: 'compliant' | 'partially_compliant' | 'non_compliant';
}

export interface ReportSummary {
  id: number;
  submitted_filename: string;
  status: string;
  compliance_score: number | null;
  error_message?: string | null;
  scheduled_at?: string | null;
  created_at: string;
  completed_at: string | null;
  sop_title: string;
  sop_brand?: string | null;
  sop_property?: string | null;
  user_name?: string;
  user_email?: string;
}
