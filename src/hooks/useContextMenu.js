import { useEffect, useRef } from 'react';
const { remote } = window.require('electron')
const { Menu, MenuItem } = remote

const useContextMenu = (menuItemArr, targetSelector, rely) => {
    const targetRef = useRef(null)
    useEffect(() => {
        const menu = new Menu()
        menuItemArr.forEach(item => {
            menu.append(new MenuItem(item))
        })
    
        const handleContextmenu = e => {
            e.preventDefault()
            targetRef.current = e.target
            if(document.querySelector(targetSelector).contains(e.target)) {
                menu.popup({ window: remote.getCurrentWindow() })
            }
        }
    
        window.addEventListener('contextmenu', handleContextmenu, false)
    
        return function cleanup() {
            window.removeEventListener('contextmenu', handleContextmenu, false)
        }
    }, rely)
    return targetRef
}

export default useContextMenu