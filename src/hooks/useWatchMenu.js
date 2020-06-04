import { useEffect } from 'react';
const { ipcRenderer } = window.require('electron');

const  useWatchMenu = ( menuObj, rely) => {
    useEffect(() => {
        Object.keys(menuObj).forEach(key => {
            ipcRenderer.on(key, menuObj[key])
        })

        return () => {
            Object.keys(menuObj).forEach(key => {
                ipcRenderer.removeListener(key, menuObj[key])
            })
          }
    })
}

export default useWatchMenu