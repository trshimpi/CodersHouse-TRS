import React  from 'react'
import { useWebRTC } from '../../hooks/useWebRTC';
import { useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import styles from './Room.module.css';

const Room = () => {

  const {id:roomId} = useParams();
  const user = useSelector( state => state.auth.user);

  const { clients ,provideRef } = useWebRTC(roomId , user);

  const handleManualLeave = () => {
    
  }

  return (
    <div>
      <div className='container'>
          <button onClick={handleManualLeave} className={styles.goBack}>
              <img src="/images/arrow-left.png" alt="arrow-left" />
              <span>All Voice Rooms</span>
          </button>
      </div>
      <h1>All connected clients</h1>
      {
        clients.map(client => {
          return <div key={client.id} className={styles.userHead}>
            <audio 
              ref={(instance)=> provideRef(instance , client.id)} //to create audioelements mapping in useWebRTC
              
              autoPlay ></audio>
            <img className={styles.userAvatar} src={client.avatar} alt="avatar" />
            <h4>{client.name}</h4>
          </div>
        })
      }
    </div>
  )
}

export default Room