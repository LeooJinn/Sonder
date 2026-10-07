import { LegalPage } from '../components/LegalPage';
import { PRIVACY } from '../lib/legal';

/** /privacy: public, like the front page. */
export default function PrivacyScreen() {
  return <LegalPage doc={PRIVACY} />;
}
