import { useCallback, useEffect, useRef, useState } from "react";

// we have created this function to run a callback after updating the state
// we are doing same using useEffect and providing state as its dependency

export const useStateWithCallback = (initialState) => {
     const [state ,setState] = useState(initialState);

    //  we don't want to rerender our component after cbref changes hence storing it in useRef()
     const cbRef = useRef();

     const updateState  = useCallback((newState , cb)=>{
        cbRef.current = cb;

        setState((prev)=>{
            return typeof newState === 'function' ? newState(prev) : newState;
        })
     },[]);

     useEffect(()=>{
        if(cbRef.current){
            cbRef.current(state);
            cbRef.current = null;
        }
        
     },[state]);

     return [state , updateState];
};