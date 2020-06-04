import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMarkdown } from '@fortawesome/free-brands-svg-icons';
import { faPlus, faFileImport  } from '@fortawesome/free-solid-svg-icons';
const classNames = require('classnames');
const {ipcRenderer} = window.require('electron');

const FileList = ({files, addTabListFilesId, updateFileName, beforeDeleteFile, searchFilesId, addFile, saveNewFile, importFiles, activeFileId}, ref) => {
    const [currentFile, setCurrentFile] = useState('')
    const [fileName, setFileName] = useState('')
    const inputRef = useRef(null)
    let searchFiles = files

    useImperativeHandle(ref, () => ({
        setCurrentFile,
        setFileName,
        closeInput,
        editFileName
      }));
    
    // 筛选files
    const newSearchFiles = []
    files.forEach(item => {
        const currentIdIndex = searchFilesId.indexOf(item.id)
        if(currentIdIndex !== -1) {
            newSearchFiles[currentIdIndex] = item
        }
    })
    searchFiles = newSearchFiles

    const closeInput = () => {
        setCurrentFile('')
        setFileName('')
    }

    const handleINputEvent = (e, file) => {
        const {keyCode} = e
        if (keyCode === 27) {
            closeInput()
            if(file.newFile) {
                beforeDeleteFile(file.id)
            }
        }else if (keyCode === 13) {
            handleInputOnBlur(e, file)
        }
    }

    // 输入框失去焦点
    const handleInputOnBlur = (e, file) => {
        const name = e.target.value.trim()
        if(file.newFile) {
            if(name) {
                saveNewFile(file.id, name)
            }else {
                beforeDeleteFile(file.id)
                closeInput()
            }
        }else {
            if(name) {
                updateFileName(currentFile, name)
            }
        }
        
    }

    // 阻止冒泡
    const stopPropagation = e => {
        e.stopPropagation()
    }

    const editFileName = (e, file) => {
        e && stopPropagation(e);
        if(file.id === currentFile) return
        setCurrentFile(file.id);
        setFileName(file.fileName)
    }

    // 阻止失去焦点
    // const preventBlur = e => {
    //     e.preventDefault()
    // }

    useEffect(() => {
        if(currentFile && inputRef.current) {
            inputRef.current.focus()
        }
    }, [currentFile, files])

    useEffect(() => {
        const handleTriggerBlur = () => {
            if(inputRef.current) {
                inputRef.current.value = ''
                inputRef.current.blur()
            }
        }
        ipcRenderer.on('triggerBlur', handleTriggerBlur)

        return () => {
            ipcRenderer.removeListener('triggerBlur', handleTriggerBlur)
          }
    })

    return (
        <div className="fileList-container list-group">
            <div className="fileList">
                {searchFiles.map(item => {
                    const fileClassName = classNames('list-group-item file d-flex justify-content-between align-items-center row rounded-0 mr-0 border-right-0', 
                    { active: activeFileId === item.id })
                    return (<div className={fileClassName}
                    key={item.id} data-id={item.id} data-file-name={item.fileName} onClick={() => addTabListFilesId(item.id)}>
                    <FontAwesomeIcon icon={faMarkdown} className="col-2"/>
                    {currentFile === item.id || item.newFile ? 
                    <input className="form-control col-10" value={fileName} onKeyUp={e => handleINputEvent(e, item)} ref={inputRef} 
                    onChange={e => setFileName(e.target.value)} onBlur={e => handleInputOnBlur(e, item)} onClick={stopPropagation}/> :
                    <span className="col-10" style={{textAlign: 'left', paddingLeft: '13px'}}>{item.fileName}</span>
                    } 
                    {/* <div className="btn-group justify-content-between col-4">
                        <button className="my-button" 
                        onClick={e => editFileName(e, item)}>
                            <FontAwesomeIcon icon={faEdit}/></button>
                        <button className="my-button" onMouseDown={preventBlur}
                        onClick={e => {stopPropagation(e);beforeDeleteFile(item.id)}}><FontAwesomeIcon icon={faTrash}/></button>
                    </div> */}
                </div>)})}
            </div>
            
            <div className="row mt-1 btn-bottom m-0">
                <button className="btn col-6 bg-primary text-white rounded-0" 
                onClick={addFile}>
                    <FontAwesomeIcon icon={faPlus} className="mr-2"/>新建</button>
                <button className="btn col-6 bg-success text-white rounded-0" onClick={importFiles}>
                    <FontAwesomeIcon icon={faFileImport} className="mr-2"/>导入</button>
            </div>
        </div>
    )
}

export default forwardRef(FileList)