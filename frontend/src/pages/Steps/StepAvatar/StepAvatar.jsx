import React, { useState , useEffect } from 'react';
import Card from '../../../components/shared/Card/Card';
import Button from '../../../components/shared/Button/Button';
import { useDispatch , useSelector } from 'react-redux';
import { setAvatar } from '../../../store/activateSlice';
import styles from './StepAvatar.module.css';
import { activate } from '../../../http';
import { setAuth } from '../../../store/authSlice';
import Loader from '../../../components/shared/Loader/Loader';

const StepAvatar = ({ onNext }) => {
    const {name , avatar} = useSelector((state)=> state.activate);
    const dispatch = useDispatch();
    const [image , setImage] = useState('/images/monkey-avatar.png'); 
    const [loading , setLoading] = useState(false);
    
    function captureImage(e){
        const file = e.target.files[0];
        
        // convert image from file format to base64 using browser apis
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onloadend = function(){
            setImage(reader.result);
            dispatch(setAvatar(reader.result));
        }

    }

    async function submit(){
        if(!name || !avatar) return;
        setLoading(true);
        try{
          const { data } = await activate({name , avatar  });
          if(data.auth){
            // check
           
                dispatch(setAuth(data));
              
          }   
        }catch(err){
            console.log(err.message)
        }finally{
            setLoading(false);
        }
        
    }

   
    

    if (loading) return <Loader message="Activation in progress..." />;
    return (
        <>
            <Card 
                    title={`Okay ,${name} !!!`} 
                    icon="monkey-emoji"
                >
                <p className={styles.subHeading}>How's this photo?</p>
                <div className={styles.avatarWrapper}>
                    <img className={styles.avatarImage} src={image} alt="avatar" />
                </div> 
                <div className="">
                    <input 
                        onChange={captureImage}
                        type="file" 
                        className={styles.avatarInput} 
                        id='avatarInput' 
                        name='avatarInput'
                    />
                    <label className={styles.avatarLabel} htmlFor="avatarInput">Choose a different photo</label>

                </div> 
                <div>
                    <Button  onClick={submit} text="Next" />
                </div>
                   
                    
            </Card>
        </>
    );
};

export default StepAvatar;
