import React , { useEffect , useState }   from 'react'
import { useWebRTC } from '../../hooks/useWebRTC';
import { useNavigate, useParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import styles from './Room.module.css';
import { getRoom } from '../../http';


const Room = () => {

  const [room , setRoom] = useState(null);
  const [isMute , setMute] = useState(true);

  const navigate = useNavigate();
  const {id:roomId} = useParams();
  const user = useSelector( state => state.auth.user);

  const { clients ,provideRef , handleMute} = useWebRTC(roomId , user);

  const handleManualLeave = () => {
    navigate(-1);
  }

  useEffect(()=>{

    handleMute(isMute, user.id);

  },[isMute])

  useEffect(()=>{
    const fetchRoom = async() => {
      const {data} = await getRoom(roomId);
      // console.log(data);
      setRoom((prev)=> data);
    }

    fetchRoom();

  },[roomId]);

  const handleMuteClick = (clientId) => {
    //mute/unmute only yourself
    if(clientId !== user.id)  return;
    setMute((isMute)=> !isMute);
  }

  return (
    <div>
      <div className='container'>
          <button onClick={handleManualLeave} className={styles.goBack}>
              <img src="/images/arrow-left.png" alt="arrow-left" />
              <span>All Voice Rooms</span>
          </button>
      </div>
      <div className={styles.clientsWrap}>
          <div className={styles.header}>
              <h2 className={styles.topic}>
                {room?.topic}
              </h2>
              <div className={styles.actions}>
                  <button className={styles.actionBtn}>
                      <img src="/images/palm.png" alt="palm-icon" />
                  </button>
                  <button onClick={handleManualLeave} className={styles.actionBtn}>
                      <img src="/images/win.png" alt="win" />
                      <span>Leave Quietly</span>
                  </button>
              </div>
          </div> 
        <div className={styles.clientsList}>
          {
            clients.map(client => {
              return (
                <div className={styles.client} key={client.id} >
                  <div className={styles.userHead}>
                    <audio 
                      ref={(instance)=> provideRef(instance , client.id)} //to create audioelements mapping in useWebRTC
                      autoPlay ></audio>
                    <img className={styles.userAvatar} src={client.avatar} alt="avatar" />
                    <button onClick={()=> handleMuteClick(client.id)} className={styles.micBtn}>
                      {
                        client.muted ? (
                          <img src="/images/mic-mute.png" alt="mic-mute-icon" />
                        ) : (
                          <img src="/images/mic.png" alt="mic-icon" />
                        )
                      }
                        
                        
                    </button>
                  </div>
                  <h4>{client.name}</h4>
                </div>
              );
            })
          }
        </div>
      </div>
      
    </div>
  )
}

export default Room