import { useContext } from 'react';
import { AuthContext } from '../Providers/AuthProvider';
import { Navigate } from 'react-router-dom';

const PrivetRoute = ({ children }) => {
  const { user, loading } = useContext(AuthContext);

  if (loading) {
    return <span className="loading loading-bars loading-xl">Loading...</span>;
  }
  if (user) {
    return children;
  }
  return <Navigate to={'/sign-in'} replace></Navigate>;
};

export default PrivetRoute;
