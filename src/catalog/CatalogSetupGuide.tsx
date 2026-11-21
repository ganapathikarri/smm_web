import { ArrowRight, BookOpen, ChevronRight, CircleHelp, Layers3, ShieldCheck } from 'lucide-react';
import type { CatalogSection } from './CatalogWorkspace';
import './catalog-guide.css';

type GuideStep = {
  section: CatalogSection;
  name: string;
  detail: string;
  instruction: string;
  example: string;
};

const STEPS: GuideStep[] = [
  { section: 'platforms', name: 'Platform', detail: 'Where it appears', instruction: 'Add a supported channel (for example Instagram or YouTube). Choose a stable code and an official policy reference. Do not duplicate a platform that already exists.', example: 'Instagram · code INSTAGRAM · status ACTIVE' },
  { section: 'categories', name: 'Category', detail: 'How to group it', instruction: 'Group similar services under a friendly category. You can assign it to a specific platform or all platforms. Customers use categories to find services quickly.', example: 'Content Strategy · content-strategy · Instagram' },
  { section: 'services', name: 'Service draft', detail: 'What you offer', instruction: 'Give the service a specific name and a complete description: who it is for, the deliverables, turnaround and exclusions. A new service starts as a draft, not a published product.', example: 'Business Profile Audit · A review with a written improvement plan, delivered within 3 business days. No guaranteed audience growth.' },
  { section: 'inputs', name: 'Customer inputs', detail: 'What you need', instruction: 'Define only the details needed to fulfil the service: a public profile URL, content brief or other safe information. Add a clear label and helpful example. Never ask for passwords, OTPs or account cookies.', example: 'Public profile URL · URL · required · “Paste your publicly visible profile link.”' },
  { section: 'pricing', name: 'Pricing', detail: 'What customers pay', instruction: 'Choose per unit, per 1,000 or fixed package. Set quantity limits, minimum charge and the tax treatment approved by your CA. Saving creates an immutable price version.', example: '₹299 per fixed package · quantity 1 · tax configuration approved before publishing' },
  { section: 'policy', name: 'Policy review', detail: 'Can you publish?', instruction: 'Review the service description, account inputs and relevant social-platform rules. Record the approval decision with a reason; then return to Services and activate it when all prerequisites pass.', example: 'APPROVED policy + active platform/category + valid price → activate from Services' },
];

export default function CatalogSetupGuide({ section, platformsCount, categoriesCount, servicesCount, onNavigate }: {
  section: CatalogSection;
  platformsCount: number;
  categoriesCount: number;
  servicesCount: number;
  onNavigate: (next: CatalogSection) => void;
}) {
  const index = STEPS.findIndex(step => step.section === section);
  const current = STEPS[Math.max(0, index)];
  const next = STEPS[index + 1];
  return <section className="catalog-setup" aria-label="Catalogue setup guide">
    <div className="catalog-setup-header">
      <div className="catalog-setup-header-icon"><Layers3 size={22}/></div>
      <div className="catalog-setup-title"><span><BookOpen size={13}/> GUIDED SETUP · STEP {index + 1} OF 6</span><h2>Build your service catalogue, one step at a time</h2><p>Start from a platform and finish with a reviewed, publishable service. Select any step to jump there.</p></div>
      <div className="catalog-setup-stats"><strong>{servicesCount}</strong><small>service drafts & listings</small></div>
    </div>
    <div className="catalog-setup-steps" role="navigation" aria-label="Catalogue creation steps">
      {STEPS.map((step, i) => <button key={step.section} type="button" className={`catalog-setup-step ${section === step.section ? 'active' : ''}`} onClick={() => onNavigate(step.section)} aria-current={section === step.section ? 'step' : undefined}>
        <span className="catalog-setup-step-count">{String(i + 1).padStart(2, '0')}</span>
        <span className="catalog-setup-step-label"><strong>{step.name}</strong><small>{step.detail}</small></span>
        <ChevronRight size={14}/>
      </button>)}
    </div>
    <div className="catalog-setup-explain">
      <div className="catalog-setup-explain-icon"><CircleHelp size={21}/></div>
      <div className="catalog-setup-explain-content"><span>WHAT TO DO ON THIS SCREEN</span><h3>{current.name}: {current.detail}</h3><p>{current.instruction}</p><div className="catalog-setup-example"><strong>Example</strong><span>{current.example}</span></div></div>
      <div className="catalog-setup-explain-action">
        {next ? <button type="button" onClick={() => onNavigate(next.section)}>Next: {next.name} <ArrowRight size={16}/></button> : <button type="button" onClick={() => onNavigate('services')}>Go to Services to activate <ArrowRight size={16}/></button>}
        <small><ShieldCheck size={13}/> Activate only after policy and price approvals.</small>
      </div>
    </div>
  </section>;
}
