import React, { useState, useEffect } from "react";
import { auth, db } from "./firebase";
import { setDoc, doc } from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { Link, useNavigate } from "react-router-dom";
import { toast } from 'react-toastify';

function Register(){
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [fname, setFname] = useState("");
    const [lname, setLname] = useState("");
    const [timezone, setTimezone] = useState("");
    const navigate = useNavigate();

    useEffect(() => {
        const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        setTimezone(detectedTimezone);
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await createUserWithEmailAndPassword(auth, email, password);
            const user = auth.currentUser;
            if (user) {
                await setDoc(doc(db, "users", user.uid), {           
                    fname: fname,
                    lname: lname,
                    email: email,
                    role: 'employee',
                    timezone: timezone,
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
            }
            toast.success(`Welcome ${fname}! Your account has been created successfully.`);
            navigate('/');
        } catch (error) {
            let errorMessage = 'Registration failed. Please try again.';
            
            switch (error.code) {
                case 'auth/email-already-in-use':
                    errorMessage = 'This email is already registered. Please use a different email.';
                    break;
                case 'auth/weak-password':
                    errorMessage = 'Password is too weak. Please use at least 6 characters.';
                    break;
                case 'auth/invalid-email':
                    errorMessage = 'Please enter a valid email address.';
                    break;
                case 'auth/operation-not-allowed':
                    errorMessage = 'Email registration is currently disabled.';
                    break;
                default:
                    errorMessage = 'Registration failed. Please try again later.';
            }
            
            toast.error(errorMessage);
        }
    }

    return (
        <div className="container mt-5">
            <div className="row justify-content-center">
                <div className="col-md-6 col-lg-4">
                    <div className="card shadow">
                        <div className="card-body">
                            <form onSubmit={handleSubmit}>
                                <h3 className="text-center mb-4">Register</h3>

                                <div className="mb-3">
                                    <label className="form-label d-block text-start">First name</label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        placeholder="First name"
                                        value={fname}
                                        onChange={(e) => setFname(e.target.value)}
                                        required
                                    />
                                </div>

                                <div className="mb-3">
                                    <label className="form-label d-block text-start">Last name</label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        placeholder="Last name"
                                        value={lname}
                                        onChange={(e) => setLname(e.target.value)}
                                    />
                                </div>

                                <div className="mb-3">
                                    <label className="form-label d-block text-start">Email address</label>
                                    <input
                                        type="email"
                                        className="form-control"
                                        placeholder="Enter email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                    />
                                </div>

                                <div className="mb-3">
                                    <label className="form-label d-block text-start">Password</label>
                                    <input
                                        type="password"
                                        className="form-control"
                                        placeholder="Enter password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                    />
                                </div>

                                <div className="mb-3">
                                    <label className="form-label d-block text-start">Timezone</label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        value={timezone}
                                        readOnly
                                        style={{ backgroundColor: '#f8f9fa' }}
                                    />
                                    <div className="form-text">
                                        Auto-detected from your system
                                    </div>
                                </div>

                                <div className="d-grid mb-3">
                                    <button type="submit" className="btn btn-primary">
                                        Sign Up
                                    </button>
                                </div>
                                
                                <p className="text-center">
                                    Already registered? <Link to="/" className="text-decoration-none">Login</Link>
                                </p>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Register;