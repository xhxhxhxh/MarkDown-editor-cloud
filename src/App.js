import React, { useState, useRef } from 'react';
import SimpleMDE from "react-simplemde-editor";
import 'bootstrap/dist/css/bootstrap.min.css';
import "easymde/dist/easymde.min.css";
import './App.scss';
import FileSearch from './components/FileSearch';
import FileList from './components/FileList';
import TabList from './components/TabList';
import fileHelper from './utils/fileHelper';
import useContextMenu from './hooks/useContextMenu';
import useWatchMenu from './hooks/useWatchMenu';
import {findParentNode, getDate} from './api/common';
const Store = window.require('electron-store');
const path = window.require('path');
const {remote, ipcRenderer} = window.require('electron');

const schema = {
	file: {
		type: 'array'
	}
};
const store = new Store({schema, name: 'files'});
const settingsStore = new Store({name: 'Settings'})
// store.delete('files')

function App() {
  const [files, setFiles] = useState(store.get('files') || [])
  const [activeFileId, setActiveFileId] = useState('')
  const [activeFile, setActiveFile] = useState({})
  const [unSavedFilesId, setUnSavedFileId] = useState([])
  const [tabListFilesId, setTabListFilesId] = useState([])
  const cacheFilesObj = {} // files的键值对id => index
  const defaultSearchFilesId = files.map((file, index) => {
    cacheFilesObj[file.id] = index
    return file.id
    })
  const [searchFilesId, setSearchFilesId] = useState(defaultSearchFilesId)
  const [searchvalue, setSearchvalue] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingText, setLoadingText] = useState('同步上传中')
  const fileSearchRef = useRef(null)
  const fileListRef = useRef(null)

  // 添加标签导航
  const addTabListFilesId = id => {
    if(!tabListFilesId.includes(id)) {
      const cacheTabListFilesId = [...tabListFilesId]
      cacheTabListFilesId.push(id)
      setTabListFilesId(cacheTabListFilesId)
    }
    changeActiveFile(id)
  }

  // 删除标签导航
  const deleteTabListFilesId = id => {
    const currentIndex = tabListFilesId.indexOf(id)
    const cacheTabListFilesId = [...tabListFilesId]
    if(currentIndex !== -1) {
      cacheTabListFilesId.splice(currentIndex, 1)
      setTabListFilesId(cacheTabListFilesId)
      deleteUnSavedFilesId(id)
    }
    if(id === activeFileId) {
      changeActiveFile(cacheTabListFilesId[0] || '')
    }
  }

  // 添加未保存文件id
  const addUnSavedFilesId = (id, content) => {
    const activeFile = files[cacheFilesObj[id]] || {}
    if(activeFile.content === content) return
    activeFile.content = content
    setActiveFile(activeFile)
    if(!unSavedFilesId.includes(id)) {
      const cacheUnSavedFilesId = [...unSavedFilesId]
      cacheUnSavedFilesId.push(id)
      setUnSavedFileId(cacheUnSavedFilesId)
    }
  }

  // 删除未保存文件id
  const deleteUnSavedFilesId = id => {
    const cacheUnSavedFilesId = [...unSavedFilesId]
    const currentIndex = cacheUnSavedFilesId.indexOf(id)
    if(currentIndex !== -1) {
      files[cacheFilesObj[id]].isLoad = false // 重新读取文件
      cacheUnSavedFilesId.splice(currentIndex, 1)
      setUnSavedFileId(cacheUnSavedFilesId)
    }
  }

  // 切换激活的文件
  const changeActiveFile = id => {
    const activeFile = files[cacheFilesObj[id]] || {}
    
    if(!activeFile.isLoad && id) {
      const qiniuIsConfiged =  ['accessKey', 'secretKey', 'bucketName', 'enableAutoSync'].every(key => !!settingsStore.get(key))
      if(qiniuIsConfiged) {
        downLoadFile(activeFile)
      }else {
        setActiveFileAfterDownload(id)
      }
      
    }else {
      setActiveFileId(id)
      setActiveFile(activeFile)
    }
  }

  // 从七牛云中下载文件
  const downLoadFile = (file) => {
    ipcRenderer.send('downloadFile', file)
  }

  const openLoading = msg => {
    setLoading(true)
    setLoadingText(msg)
  }

  // 批量下载成功后
  const downloadSuccessAll = (filterLocalFiles, filterCloudFiles) => {
    const newFiles = [...files]
    let lastId = newFiles.length > 0 ? newFiles[newFiles.length - 1].id : 0
    const searchFileIdArr = [...defaultSearchFilesId]

    filterCloudFiles.forEach(file => {
      const fileName = file.key.split('.')[0]
      const loadlFile = filterLocalFiles[fileName]
      const putTime = Math.round(file.putTime / 10000)
      const uploadTime = getDate(new Date())
      if(loadlFile) {
        const id = loadlFile.id
        const currentFile = newFiles[cacheFilesObj[id]]
        currentFile.putTime = putTime
        currentFile.isSynced = true
        currentFile.uploadTime = uploadTime
      }else {
        const newFile = {
          id: ++lastId,
          fileName,
          path: settingsStore.get('savedFileLocation') || remote.app.getPath('documents'),
          uploadTime,
          putTime,
          isSynced: true
        }
        searchFileIdArr.push(lastId)
        newFiles.push(newFile)
      }
    })

    setSearchFilesId(searchFileIdArr)
    setFiles(newFiles)
    setStoreFile('files', newFiles)
  }


  // 下载完后更新ActiveFile
  const setActiveFileAfterDownload = (id, putTime) => {
    const newFiles = [...files]
    const activeFile = newFiles[cacheFilesObj[id]] || {}
    const filePath = path.join(activeFile.path, `${activeFile.fileName}.md`)
    setLoading(false)
    fileHelper.readFile(filePath).then(data => {
      activeFile.content = data
      activeFile.isLoad = true
      if(putTime) {
        activeFile.putTime = putTime
        activeFile.isSynced = true
        activeFile.uploadTime = getDate(new Date())
        setFiles(newFiles)
        setStoreFile('files', newFiles)
      }
      setActiveFileId(id)
      setActiveFile(activeFile)
    })
  }

  // 更新文件名
  const updateFileName = (id, name) => {
    const newFiles = [...files]
    const currentFile = newFiles[cacheFilesObj[id]]
    const oldName = currentFile.fileName
    const oldFilePath = path.join(currentFile.path, `${oldName}.md`)
    const filePath = path.join(currentFile.path, `${name}.md`)

    if(filePath === oldFilePath) {
      fileListRef.current.closeInput()
      return
    }

    fileHelper.isFileExisted(filePath).then(() => {
      console.log('文件已存在')
      fileListRef.current.closeInput()
      ipcRenderer.send('open-dialog', '文件名已存在')
    }).catch((err) => {
      fileHelper.renameFile(oldFilePath, filePath).then(() => {
        // 重新搜索
        currentFile.fileName = name
        searchFile(searchvalue)
        fileListRef.current.closeInput()

        if (!currentFile.newFile) {
          setFiles(newFiles)
          setStoreFile('files', newFiles)
        }

        const qiniuIsConfiged =  ['accessKey', 'secretKey', 'bucketName', 'enableAutoSync'].every(key => !!settingsStore.get(key))
        if(qiniuIsConfiged && currentFile.isSynced) {
          ipcRenderer.send('fileRename', oldName, name)
        }
      }).catch(err => {
        console.log(err)
        fileListRef.current.closeInput()
      })
    })   
  }

  // 删除文件
  const deleteFile = id => {
    const newFiles = [...files]
    const currentFile = newFiles.splice(cacheFilesObj[id], 1)
    const cacheTabListFilesId = [...tabListFilesId]
    const currentIndex = cacheTabListFilesId.indexOf(id)
    if(currentIndex !== -1) {
      cacheTabListFilesId.splice(currentIndex, 1)
      setTabListFilesId(cacheTabListFilesId)
    }
    
    if(id === activeFileId) {
      changeActiveFile(cacheTabListFilesId[0] || '')    
    }

    const qiniuIsConfiged =  ['accessKey', 'secretKey', 'bucketName', 'enableAutoSync'].every(key => !!settingsStore.get(key))
    if(qiniuIsConfiged && currentFile[0].isSynced) {
      ipcRenderer.send('deleteFile', files[cacheFilesObj[id]].fileName)
    }

    fileListRef.current.closeInput()
    setFiles(newFiles)
    setStoreFile('files', newFiles) 
  }

  const beforeDeleteFile = id => {
    const currentFile = files[cacheFilesObj[id]]
    if(currentFile.newFile) { // 新文件直接删除
      deleteFile(id)
    }else {
      const filePath = path.join(currentFile.path, `${currentFile.fileName}.md`)
      fileHelper.deleteFile(filePath).then(() => {
        deleteFile(id)
      }).catch(err => {
        console.log(err)
      })
    }
  }

  // 搜索文件
  const searchFile = value => {
    const searchFileIdArr = []
    files.forEach(file => {
      if(!value.trim() || file.fileName.includes(value)) {
        searchFileIdArr.push(file.id)
      }
    })
    setSearchFilesId(searchFileIdArr)
    setSearchvalue(value)
  }

  // 新建文件
  const addFile = () => {
    if(files.length && files[files.length - 1].newFile) return
    const newId = files.length ? files[files.length - 1].id + 1 : 1
    fileSearchRef.current.closeSearch()
    fileListRef.current.setCurrentFile(newId)
    fileListRef.current.setFileName('')
    const searchFileIdArr = [...defaultSearchFilesId, newId]
    const newFiles = [
      ...files,
      {
        id: newId,
        fileName: '',
        content: '',
        newFile: true
      }
    ]
    setSearchFilesId(searchFileIdArr)
    setFiles(newFiles)
  }

  // 保存新建的文件
  const saveNewFile = (id, name) => {
    const cacheFiles = [...files]
    const newFile = cacheFiles[cacheFilesObj[id]]
    newFile.fileName = name
    const savedLocation = settingsStore.get('savedFileLocation') || remote.app.getPath('documents')
    const filePath = path.join(savedLocation, `${name}.md`)
    fileHelper.isFileExisted(filePath).then((data) => {
      deleteFile(id)
      ipcRenderer.send('open-dialog', '文件已存在')
    }).catch((err) => {
      fileHelper.writeFile(filePath, `### 请输入内容`).then(() => {
        newFile.newFile = false
        newFile.path = path.dirname(filePath)
        setFiles(cacheFiles)
        setStoreFile('files', cacheFiles)
        addTabListFilesId(id)
        // 关闭输入框
        fileListRef.current.closeInput()
      }).catch(err => {
        console.log(err)
      })
    })
  }

  // 保存store中的内容
  const setStoreFile = (name, data) => {
    if(name === 'files') {
      const newFiles = []
      data.forEach(file => {
        const {content, isLoad, newFile, ...cutFile} = file 
        newFiles.push(cutFile)
      })
      store.set('files', newFiles)
    }
  }

  // 导入文件
  const importFiles = () => {
    remote.dialog.showOpenDialog({
      title: '选择要导入的 MarkDown 文件',
      properties: ['openFile', 'multiSelections'],
      filters: [
        {name:'MarkDown files', extensions: ['md']}
      ]
    }).then(({filePaths}) => {
      if(filePaths.length > 0) {
        let lastId = files.length ? files[files.length - 1].id : 0
        const searchFileIdArr = [...defaultSearchFilesId]
        const filteredFilePaths = filePaths.filter(path => {
          const alreadyAdded = files.find(file => {
            return file.path + '\\' + file.fileName + '.md' === path
          })
          return !alreadyAdded
        })
        if(filteredFilePaths.length === 0) {
          ipcRenderer.send('open-dialog', '文件已存在')
          return
        }
        const newPathArr = filteredFilePaths.map(filePath => {
          searchFileIdArr.push(++lastId)
          return {
            id: lastId,
            path: path.dirname(filePath),
            fileName: path.basename(filePath, path.extname(filePath))
          }
        })
        
        const newFiles = files.concat(newPathArr)
        setSearchFilesId(searchFileIdArr)
        setFiles(newFiles)
        setStoreFile('files', newFiles)
      }
    }).catch(err => {
      console.log(err)
    })
  }

  // 保存全部文件
  const saveFiles = () => {
    unSavedFilesId.forEach(id => {
      const currentFile = files[cacheFilesObj[id]]
      const fileName = currentFile.fileName
      const content = currentFile.content
      const filePath = path.join(currentFile.path, `${fileName}.md`)
      fileHelper.writeFile(filePath, content)
    })
    setUnSavedFileId([])
  }

  // 保存单个文件
  const saveSingleFile = () => {
    const unSavedFileId = [...unSavedFilesId]
    const index = unSavedFileId.indexOf(activeFileId)
    if(index !== -1) {
      const currentFile = files[cacheFilesObj[activeFileId]]
      const fileName = currentFile.fileName
      const content = currentFile.content
      const filePath = path.join(currentFile.path, `${fileName}.md`)
      fileHelper.writeFile(filePath, content).then(() => {
        // 上传至七牛云
        const qiniuIsConfiged = ['accessKey', 'secretKey', 'bucketName', 'enableAutoSync'].every(key => !!settingsStore.get(key))
        if(qiniuIsConfiged) {
          ipcRenderer.send('uploadFile', {filePath, id: activeFileId})
        }
      })
      unSavedFileId.splice(index, 1)
      setUnSavedFileId(unSavedFileId)
    }
  }

  // 上传成功后更新状态
  const uploadSuccessed = ({id, status}) => {
    const cacheFiles = [...files]
    const newFile = cacheFiles[cacheFilesObj[id]]
    newFile.isSynced = status
    if(status) {
      newFile.uploadTime = getDate(new Date())
    }
    setFiles(cacheFiles)
    setStoreFile('files', cacheFiles)
  }

  // 批量上传成功
  const uploadSuccessAll = () => {
    const newFiles = []
    files.forEach(file => {
      const newFile = {
        ...file,
        uploadTime: getDate(new Date()),
        isSynced: true
      }
      newFiles.push(newFile)
    })
    if(activeFileId) {
      const activeFile = newFiles[cacheFilesObj[activeFileId]]
      setActiveFile(activeFile)
    }
    setFiles(newFiles)
    setStoreFile('files', newFiles)
  }

  // 打开菜单
  const targetRef = useContextMenu([
    { 
      label: '打开', 
      click: () => { 
        const parentNode = findParentNode(targetRef.current, 'file')
        addTabListFilesId(Number(parentNode.dataset['id']))
      } 
    },
    { 
      label: '删除', 
      click: () => { 
        const parentNode = findParentNode(targetRef.current, 'file')
        beforeDeleteFile(Number(parentNode.dataset['id']))
      } 
    },
    { 
      label: '重命名', 
      click: () => { 
        const parentNode = findParentNode(targetRef.current, 'file')
        const id = Number(parentNode.dataset['id'])
        const fileName = parentNode.dataset['fileName']
        fileListRef.current.editFileName(null, {id, fileName})
      } 
    }
  ], '.fileList', [files, tabListFilesId, activeFileId])

  // 监听原生菜单
  useWatchMenu({
    'create-new-file': addFile,
    'save-edit-file': saveSingleFile,
    'search-file': () => {fileSearchRef.current.openSearch()},
    'import-file': importFiles,
    'upload-success': (event, data) => {uploadSuccessed(data)},
    'uploadSuccessAll': uploadSuccessAll,
    'downloadFile': (event, id, putTime) => {setActiveFileAfterDownload(id, putTime)},
    'downloadSuccessAll': (event, filterLocalFiles, filterCloudFiles) => {downloadSuccessAll(filterLocalFiles, filterCloudFiles)},
    'changeLoading': (event, msg) => openLoading(msg),
    'closeLoading': () => {setLoading(false)},
  }, [files])

  return (
    <div className="App container-fluid">
      <div className="row" style={{display: 'block'}}>
        <div className="bg-light left-panel left-area p-0 border-right float-left" style={{width: '300px', height: '100%'}}>
          <FileSearch title="我的文档" searchFile={searchFile} ref={fileSearchRef}/>
          <FileList files={files} addTabListFilesId={addTabListFilesId} updateFileName={updateFileName} beforeDeleteFile={beforeDeleteFile} 
          searchFilesId={searchFilesId} addFile={addFile} saveNewFile={saveNewFile} ref={fileListRef} importFiles={importFiles} 
          activeFileId={activeFileId}/>      
        </div>
        <div className="bg-white p-0" style={{overflow: 'hidden', height: '100%'}}>
          <TabList files={files} tabListFilesId={tabListFilesId} activeFileId={activeFileId} unSavedFilesId={unSavedFilesId} changeActiveFile={changeActiveFile} 
          deleteTabListFilesId={deleteTabListFilesId}></TabList>
          {activeFileId ? 
            <SimpleMDE onChange={value => addUnSavedFilesId(activeFile.id, value)} key={activeFile.id} options={{minHeight: 'calc(100vh - 150px)'}}
            value={activeFile.content} className="text-left"/> :
            <div className="black-area">选择或者创建新的Markdown文档</div>
          }
          {activeFile.isSynced && <span className="isSynced">状态：已同步 &nbsp;&nbsp; 上次同步时间：{activeFile.uploadTime}</span>}
          {loading && 
            <div className="my-loading">
              <div className="spinner-border" role="status">
                <span className="sr-only">Loading...</span>
              </div>
              <h5>{loadingText}</h5>
            </div>
          }         
        </div>
      </div>
    </div>
  );
}

export default App;
