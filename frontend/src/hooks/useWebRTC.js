import { useCallback, useEffect, useRef, useState } from "react";
import { ACTIONS } from "../actions";
import { socketInit } from "../socket";
import { useStateWithCallback } from "./useStateWithCallback";
import freeice from 'freeice';


export const useWebRTC = (roomId , user) => {
   const [clients ,setClients] = useStateWithCallback([]);
   const audioElements = useRef({});   // users userId->audio instance mapping
   const connections = useRef({});     // users socketId-> peerconnection mapping
   const localMediaStream = useRef(null);  // storing local audio data (mic data)
  
   const socket = useRef(null);
   const clientsRef = useRef([]);

   useEffect(()=>{
        socket.current = socketInit();
   },[])

   const provideRef = (instance , userId) => {
        audioElements.current[userId] = instance;
   }

   // wrapper function for setClients with some additional functionality

   const addNewClient = useCallback(
    (newClient , cb)=>{
        const lookingFor = clients.find((client) => client.id === newClient.id);
        if(lookingFor === undefined){
            setClients((existingClients)=> [...existingClients , newClient], cb )
        }
        
    },
    [clients ,setClients ],)

//    capture media 
   useEffect(()=>{
        const startCapture = async () =>{
            localMediaStream.current =  await navigator.mediaDevices.getUserMedia({
                audio:true
            });
        };

        startCapture().then(()=>{
            addNewClient({...user , muted: true }, ()=>{
                const localElement = audioElements.current[user.id];
                if(localElement){
                    localElement.volume = 0;  // if not done you will hear your own voice
                    localElement.srcObject = localMediaStream.current;
                }

                // send it to server via websockets
                //socket emit JOIN
                socket.current.emit(ACTIONS.JOIN,{ roomId , user});
                
            })
        });

        // claning function 
        return () => {
            // Leaving the room
            localMediaStream.current.getTracks()
                .forEach(track => track.stop());

            socket.current.emit(ACTIONS.LEAVE , { roomId });
        }

   },[])

   
//    peerId is same as socketID
   useEffect(()=>{

        const handleNewPeer = async ({peerId , createOffer , user : remoteUser}) => {
            //if already connected then give warning
            if(peerId in connections.current){
                return console.log(`you are already connected with ${peerId} (${user.name})`);
            }

            // create new peer connection
            connections.current[peerId] = new RTCPeerConnection({
                iceServers : freeice()
            });

            // handle new ice candidate
            connections.current[peerId].onicecandidate = (event) => {
                // sending ice candidate to peers so that they can start peertopeer conncetion
                socket.current.emit(ACTIONS.RELAY_ICE ,{
                    peerId,
                    icecandidate :event.candidate
                })
            }

            // handle on track on this connection (handling incoming data stream)
            connections.current[peerId].ontrack = ({
                streams : [remoteStream]
            }) => {
                // add this stream to clients
                addNewClient({ ...remoteUser , muted: true } , ()=>{
                    // check if audio element corresponding to this client already exists?
                    if(audioElements.current[remoteUser.id]){
                        audioElements.current[remoteUser.id].srcObject = remoteStream;
                    }else{

                        // check every second if audio element is present or not 
                        let settled = false;
                        const interval = setInterval(() => {
                            if(audioElements.current[remoteUser.id]){
                                audioElements.current[remoteUser.id].srcObject = remoteStream;
                                settled = true;
                            }
                            if(settled){
                                // clear interval once audio stream is attached 
                                clearInterval(interval);
                            }
                        }, 1000);
                    }
                })
            }

            // Add local track to remote connection (send our voice to other connections)
            // we can also send video and all ... modify here if you want to implement that fucntionality
            localMediaStream.current.getTracks().forEach(track => {
                connections.current[peerId].addTrack(track , localMediaStream.current )
            });

            // Offer Creation
            if(createOffer){
                const offer = await connections.current[peerId].createOffer();

                // add offer to localdescription
                await connections.current[peerId].setLocalDescription(offer);
                // send offer to another client through websocket
                socket.current.emit(ACTIONS.RELAY_SDP , {
                    peerId ,
                    sessionDescription : offer
                })
            }


        }

        socket.current.on(ACTIONS.ADD_PEER ,handleNewPeer);

        return ()=>{
            socket.current.off(ACTIONS.ADD_PEER);
        }
   },[]);


   // handle ice candidate coming from server
   useEffect(()=>{
        socket.current.on(ACTIONS.ICE_CANDIDATE , ({peerId , icecandidate})=>{
            if(icecandidate){
                connections.current[peerId].addIceCandidate(icecandidate);
            }
        })

        return ()=>{
            socket.current.off(ACTIONS.ICE_CANDIDATE);
        }
   },[]);

   // handle sdp
   useEffect(()=>{

       const handleRemoteSdp = async ({peerId , sessionDescription : remoteSessionDescription}) => {
            connections.current[peerId].setRemoteDescription(
                new RTCSessionDescription(remoteSessionDescription)
            )

            // if session description is type of offer then create an anser
            if(remoteSessionDescription.type === 'offer'){
                const connection  = connections.current[peerId];
                const answer = await connection.createAnswer();

                connection.setLocalDescription(answer);

                socket.current.emit(ACTIONS.RELAY_SDP , {
                    peerId ,
                    sessionDescription: answer
                })
            }
       } 

       socket.current.on(ACTIONS.SESSION_DESCRIPTION , handleRemoteSdp );

       return () => {
        socket.current.off(ACTIONS.SESSION_DESCRIPTION);
       }
   },[])


   // Handle remove peer
   useEffect(()=>{

        const handleRemovePeer = async ({ peerId , userId }) => {
            if(connections.current[peerId]){
                // close webRTC connection
                connections.current[peerId].close();
            }

            // remove peer from connections as well as audio elements and clients list
            delete connections.current[peerId];
            delete audioElements.current[peerId];

            setClients(list => list.filter(client=> client.id !== userId));
        };

        socket.current.on(ACTIONS.REMOVE_PEER , handleRemovePeer);

        return ()=>{
            socket.current.off(ACTIONS.REMOVE_PEER)
        }
   },[]);


   useEffect(()=>{

        clientsRef.current = clients;

   },[clients])

   // listen for mute / unmute coming from server
   useEffect(()=>{
        socket.current.on(ACTIONS.MUTE,({peerId , userId})=>{
            setMute(true , userId);
        });

        socket.current.on(ACTIONS.UN_MUTE,({peerId , userId})=>{
            setMute(false , userId);
        });

        const setMute = (mute , userId) => {
            const clientIdx = clientsRef.current.map(client => client.id).indexOf(userId);
            console.log("idx", clientIdx);

            const connectedClients = JSON.parse(JSON.stringify(clientsRef.current));
            if(clientIdx > -1){
                connectedClients[clientIdx].muted = mute;
                setClients(connectedClients);
            }
        };

   },[])


   // Handling mute
   const handleMute = (isMute , userId) => {
        console.log('mute' , isMute);

        let settled = false;

        let interval = setInterval(()=>{
            if(localMediaStream.current){
                localMediaStream.current.getTracks()[0].enabled = !isMute;
                if(isMute){
                    // send other clients that i'm muted to update their UI
                    socket.current.emit(ACTIONS.MUTE , {
                        roomId , 
                        userId,
                    });
                }else{
                    socket.current.emit(ACTIONS.UN_MUTE ,{
                        roomId,
                        userId,
                    });
                }
                settled =  true;
            }

            if(settled){
                clearInterval(interval);
            }

        }, 200);
        
        
   }

   return { clients , provideRef , handleMute };
}