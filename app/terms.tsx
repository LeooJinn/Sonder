import { LegalPage } from '../components/LegalPage';
import { TERMS } from '../lib/legal';

/** /terms: public, like the front page. */
export default function TermsScreen() {
  return <LegalPage doc={TERMS} />;
}
