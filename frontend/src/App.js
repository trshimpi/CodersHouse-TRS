import './App.css';
import { BrowserRouter , Routes , Route , Navigate , useLocation } from 'react-router-dom';
import Home from './pages/Home/Home';
import Navigation from './components/shared/Navigation/Navigation';
import Authenticate from './pages/Authenticate/Authenticate';
import Activate from './pages/Activate/Activate';
import Rooms from './pages/Rooms/Rooms';
import Room from './pages/Room/Room';
import { useSelector } from 'react-redux';
import { useLoadingWithRefresh } from './hooks/useLoadingWithRefresh';
import Loader from './components/shared/Loader/Loader';


function App() {
  // call refresh endpoint
  const { loading } = useLoadingWithRefresh();

  return loading ? (
    <Loader message="Loading, please wait.." />
  ) : (
    <BrowserRouter>
      <Navigation/>
      <Routes>
        <Route path='/' element={
            <GuestRoute>
            <Home/>
            </GuestRoute>
          } 
        />
        <Route path='/authenticate' element={
            <GuestRoute>
                <Authenticate/>
            </GuestRoute>
          } 
        />
        <Route path='/activate' element={
            <SemiProtectedRoute>
                <Activate/>
            </SemiProtectedRoute>
          } 
        />
        <Route path='/rooms' element={
            <ProtectedRoute>
                <Rooms/>
            </ProtectedRoute>
          } 
        />
        <Route path='/room/:id' element={
            <ProtectedRoute>
                <Room />
            </ProtectedRoute>
          } 
        />
        
      </Routes>
    </BrowserRouter>
  );
}

const GuestRoute = ({children}) => {

  const {isAuth} = useSelector((state)=> state.auth);
  const location = useLocation();
  return(
    isAuth ? <Navigate to='/rooms' state={{ from:location}} /> : (children) 
  )
}

const SemiProtectedRoute = ({children}) => {
  const {isAuth ,user} = useSelector((state)=> state.auth);
  const location = useLocation();
  return (
    !isAuth ?
     <Navigate to='/' state={{ from:location}} /> 
     : isAuth && !user.activated ? 
     children 
     : <Navigate to='/rooms' />
  )
}

const ProtectedRoute = ({children}) => {
  const {isAuth ,user} = useSelector((state)=> state.auth);
  const location = useLocation();
  return (
    !isAuth ?
     <Navigate to='/' state={{ from:location}} /> 
     : isAuth && !user.activated ? 
      <Navigate to='/activate' /> 
     : children
  )
}

export default App;
