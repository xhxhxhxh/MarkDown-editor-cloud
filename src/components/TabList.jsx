import React from "react";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';
import './tabList.scss';
const classNames = require('classnames');

const TabList = ({files, activeFileId, unSavedFilesId, changeActiveFile, deleteTabListFilesId, tabListFilesId}) => {
    const tabListFilesArr = new Array(tabListFilesId.length)
    files.forEach(item => {
      const currentIdIndex = tabListFilesId.indexOf(item.id)
      if(currentIdIndex !== -1) {
        tabListFilesArr[currentIdIndex] = item
      }
    })
    return (
        <div className="tabTist-container" style={{height: '41px'}}>
            <ul className="nav nav-pills" style={{width: tabListFilesArr.length * 100 + 'px'}}>
                {tabListFilesArr.map(item => {
                    const isSaved = unSavedFilesId.includes(item.id)
                    const navClassName = classNames('nav-link text-left rounded-0 border border-bottom-0 border-left-0', 
                    { active: activeFileId === item.id }, { saved: isSaved })
                    return (
                        <li className="nav-item" key={item.id} onClick={() => changeActiveFile(item.id)}>
                            <a className={navClassName} href="#">
                                <span className="mr-2">{item.fileName}</span>
                                <FontAwesomeIcon icon={faTimes} className="times" onClick={e => {e.stopPropagation(); 
                                    deleteTabListFilesId(item.id)}}/>
                            </a>                            
                        </li>
                    )
                })}
            </ul>
        </div>
    )
}

export default TabList