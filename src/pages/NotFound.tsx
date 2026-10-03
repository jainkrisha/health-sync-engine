import { Link } from 'react-router-dom';
import { EmptyState } from '../components/ui';

export default function NotFound() {
  return (
    <EmptyState
      icon="search"
      title="Page not found"
      message="That page does not exist."
      action={<Link to="/dashboard" className="btn-primary">Back to dashboard</Link>}
    />
  );
}
