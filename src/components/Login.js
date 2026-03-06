import React, { useState } from "react";
import { auth, db } from "./firebase";
import { doc , getDoc} from "firebase/firestore";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useNavigate, Link } from "react-router-dom";
import { toast } from 'react-toastify';

function Login(){
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        
        try {
           const userCredential = await signInWithEmailAndPassword(auth, email, password);
           const user = userCredential.user;
              const userDoc = await getDoc(doc(db, "users", user.uid));
              if (userDoc.exists()) {
                const userData = userDoc.data();
                 localStorage.setItem('userRole', userData.role);
                console.log("User logged in with role:", userData.role);
                
                toast.success(` Welcome back, ${userData.fname || 'User'}!`, {
                    position: "top-right",
                    autoClose: 2000,
                });
                
                setTimeout(() => {
                    if (userData.role === "admin" || !userData.role) {
                        navigate('/adminDashboard');
                    } else {
                        navigate('/employeeDashboard');
                    }
                }, 1000);
                
               } else {
                localStorage.setItem('userRole', 'admin');
                toast.success(' Login successful! Welcome!', {
                    position: "top-right",
                    autoClose: 2000,
                });
                setTimeout(() => navigate('/adminDashboard'), 1000);
              }
        } catch (error) {
            console.error("Error logging in user: ", error);
            
            let errorMessage = "Login failed. Please try again.";
            
            switch (error.code) {
                case 'auth/user-not-found':
                    errorMessage = "No account found with this email address.";
                    break;
                case 'auth/wrong-password':
                    errorMessage = "Incorrect password. Please try again.";
                    break;
                case 'auth/invalid-credential':
                    errorMessage = "Invalid email or password. Please check your credentials.";
                    break;
                case 'auth/invalid-email':
                    errorMessage = "Invalid email address format.";
                    break;
                case 'auth/user-disabled':
                    errorMessage = "This account has been disabled.";
                    break;
                case 'auth/too-many-requests':
                    errorMessage = "Too many failed attempts. Please try again later.";
                    break;
                default:
                    errorMessage = error.message || "Login failed. Please try again.";
            }
            
            toast.error(` ${errorMessage}`, {
                position: "top-right",
                autoClose: 4000,
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container mt-5">
            <div className="row justify-content-center">
                <div className="col-md-6 col-lg-4">
                      <h2 className="text-center mb-3 text-primary">MINI HCM</h2>
                    <div className="card shadow">
                        
                        <div className="card-body">
                            <form onSubmit={handleSubmit}>
                                <h3 className="text-center mb-4">Login</h3>

                                <div className="mb-3">
                                    <label className="form-label d-block text-start">Email Address</label>
                                    <input
                                        type="email"
                                        className="form-control"
                                        placeholder="Enter Email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        disabled={loading}
                                    />
                                </div>    

                                <div className="mb-3">
                                    <label className="form-label d-block text-start">Password</label>
                                    <input
                                        type="password"
                                        className="form-control"
                                        placeholder="Enter Password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        disabled={loading}
                                    />
                                </div>
                                
                                <div className="d-grid mb-3">
                                    <button type="submit" className="btn btn-primary" disabled={loading}>
                                        {loading ? (
                                            <>
                                                <span className="spinner-border spinner-border-sm me-2"></span>
                                                Logging in...
                                            </>
                                        ) : (
                                            ' Login'
                                        )}
                                    </button>
                                </div>
                                
                                <p className="text-center">
                                    Haven't registered? <Link to="/register" className="text-decoration-none">Register</Link>
                                </p>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Login;