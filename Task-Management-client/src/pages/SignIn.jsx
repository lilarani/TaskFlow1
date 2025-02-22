import Lottie from 'lottie-react';
import animation from '../../public/loginAnimation.json';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '../firebase/firebase.config';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const SignIn = () => {
  const provider = new GoogleAuthProvider();
  const navigate = useNavigate();

  const signInWithGoogle = () => {
    signInWithPopup(auth, provider)
      .then(res => {
        const info = {
          user: res.user.displayName,
          email: res.user.email,
        };
        axios
          .post('https://taskflow-server-f50d.onrender.com/usersInfo', info)
          .then(response => {
            navigate('/');
          })
          .catch(err => {
            console.log(err.message);
          });
      })
      .catch(err => {
        console.log(err.message);
      });
  };

  return (
    <div className="hero bg-base-200 min-h-screen">
      <div className="hero-content flex-col lg:flex-row-reverse">
        <div className="text-center lg:text-left">
          <Lottie animationData={animation}></Lottie>
        </div>
        <div className="card bg-base-100 w-full h-96 max-w-sm shrink-0 shadow-2xl">
          <div className="card-body flex justify-center items-center ">
            <button onClick={signInWithGoogle} className="button ">
              Sign-in with Google
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignIn;
