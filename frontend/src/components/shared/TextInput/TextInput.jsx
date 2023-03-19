import React from 'react'
import styles from './TextInput.module.css';

const TextInput = (props) => {
  return (
    <div>
        <input 
          className={styles.input} 
          type="text" {...props} 
          style={{
            width: props.fullwidth === "true" ? '100%' : 'inherit' ,
            }}/>
    </div>
  )
}

export default TextInput