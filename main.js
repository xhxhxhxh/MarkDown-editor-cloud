// Modules to control application life and create native browser window
const {app, BrowserWindow, Menu, ipcMain, dialog} = require('electron')
const path = require('path')
const dev = require('electron-is-dev') // 看是否是开发环境
const menuTemplate = require('./src/menuTemplate')
const Store = require('electron-store')
const settingsStore = new Store({ name: 'Settings'})
const filesStore = new Store({ name: 'files' });
const QiniuAPI = require('./src/api/qiniu')
const url = require('url')
const devtron = require('devtron')

function createQiNiu() {
  const accessKey = settingsStore.get('accessKey')
  const secretKey = settingsStore.get('secretKey')
  const bucketName = settingsStore.get('bucketName')
  return new QiniuAPI(accessKey, secretKey, bucketName)
}

function createWindow () {
  // Create the browser window.
  devtron.install()
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    webPreferences: {
      // preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
    }
  })

  // and load the index.html of the app.
  // mainWindow.loadFile('index.html')
  // mainWindow.webContents.openDevTools() // 打开开发者工具
  const productionLocation = `file://${path.join(__dirname, './index.html')}`
  
  // const productionLocation = url.format(
  //   {
  //     pathname: path.join(__dirname, './build/index.html'),
  //     protocol: 'file:',
  //     slashes: true
  //   }
  // )
  const urlLocation = dev ? 'http://localhost:3000' : productionLocation
  mainWindow.loadURL(urlLocation)

  // 弹出设置窗口
  ipcMain.on('open-settings-window', () => {
    let settingsWindow = new BrowserWindow({
      width: 500,
      height: 450,
      parent: mainWindow,
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: true
      },
      show: false,
      backgroundColor: '#efefef'
    })

    const settingsFileLocation = `file://${path.join(__dirname, dev ? './settings/settings.html' : '../settings/settings.html')}`
    settingsWindow.loadURL(settingsFileLocation)
    settingsWindow.once('ready-to-show', () => {
      settingsWindow.show()
    })
    settingsWindow.on('closed', () => {
      settingsWindow = null
    })
  })

  // set menu
  const menu = Menu.buildFromTemplate(menuTemplate)
  Menu.setApplicationMenu(menu)

  // 更新上方导航栏
  ipcMain.on('config-is-saved', () => {
    let qiniuMenu = process.platform === 'darwin' ? menu.items[3] : menu.items[2]
    const switchItem = (toggle) => {
      const arr = [1, 2, 3]
      arr.forEach(number => {
        qiniuMenu.submenu.items[number].enabled = toggle
      })
    }
    const qiniuIsConfiged =  ['accessKey', 'secretKey', 'bucketName'].every(key => !!settingsStore.get(key))
    switchItem(qiniuIsConfiged)
  })

  // 上传文件至七牛云
  ipcMain.on('uploadFile', (event, data) => {
    const qiniu = createQiNiu()
    qiniu.uploadFile(data.filePath).then(res => {
      mainWindow.webContents.send('upload-success', {id: data.id, status: true})
      console.log('上传成功')
    }).catch(() => {
      dialog.showErrorBox('同步失败', '请检查参数是否设置正确')
    })
  })

  // 弹窗提醒
  ipcMain.on('open-dialog', (event, msg) => {
    dialog.showMessageBox({
      type: 'warning',
      title: `提示`,
      message: msg
    })
  })

  // 全部上传
  ipcMain.on('upload-all-to-qiniu', (event) => {
    const qiniuIsConfiged =  ['accessKey', 'secretKey', 'bucketName'].every(key => !!settingsStore.get(key))
    if(!qiniuIsConfiged) return
    mainWindow.webContents.send('triggerBlur')
    const files = filesStore.get('files') || []
    const qiniu = createQiNiu()
    const uploadPromiseArr = files.map(file => {
      const fileName = file.fileName
      const path = file.path
      return qiniu.uploadFile(path + '\\' + fileName + '.md')
    })
    mainWindow.webContents.send('changeLoading', '文件上传中')
    Promise.all(uploadPromiseArr).then(() => {
      dialog.showMessageBox({
        type: 'info',
        title: `成功上传了${files.length}个文件`,
        message: `成功上传了${files.length}个文件`
      })
      mainWindow.webContents.send('uploadSuccessAll')
      console.log('批量上传成功')
    }).catch(() => {
      dialog.showErrorBox('同步失败', '请检查参数是否设置正确')
    }).finally(() => {
      mainWindow.webContents.send('closeLoading')
    })
  })

  // 批量下载
  ipcMain.on('download-all-to-qiniu', (event) => {
    const qiniuIsConfiged =  ['accessKey', 'secretKey', 'bucketName'].every(key => !!settingsStore.get(key))
    if(!qiniuIsConfiged) return
    mainWindow.webContents.send('triggerBlur')
    const qiniu = createQiNiu()
    qiniu.getFileInfoList().then((data) => {
      const fileInfoList = data.items
      const savedFileLocation = settingsStore.get('savedFileLocation')
      const files = filesStore.get('files') || []

      // 过滤本地文件（根据savedFileLocation）
      const filterLocalFiles = files.reduce((filesObj, current) => {
        if(current.path === savedFileLocation) {
          filesObj[current.fileName] = current
        }
        return filesObj
      }, {})

      // 过滤云文件
      const filterCloudFiles = fileInfoList.filter(file => {
        const fileName = file.key.split('.')[0]
        const putTime = Math.round(file.putTime / 10000)
        const correspondLocalFile = filterLocalFiles[fileName]
        return !correspondLocalFile || (correspondLocalFile && (!correspondLocalFile.putTime || putTime > correspondLocalFile.putTime))
      })
      
      // 开始批量下载
      mainWindow.webContents.send('changeLoading', '文件下载中')
      const downloadPromiseArr = filterCloudFiles.map(file => {
        const fileName = file.key
        return qiniu.downloadFile(fileName, savedFileLocation + '\\' + fileName)
      })
      Promise.all(downloadPromiseArr).then(() => {
        dialog.showMessageBox({
          type: 'info',
          title: `成功下载了${downloadPromiseArr.length}个文件`,
          message: `成功下载了${downloadPromiseArr.length}个文件`
        })
        mainWindow.webContents.send('downloadSuccessAll', filterLocalFiles, filterCloudFiles)
        console.log('批量下载成功')
      }).catch((err) => {
        console.log(err)
        dialog.showErrorBox('下载失败', '请检查参数是否设置正确')
      }).finally(() => {
        mainWindow.webContents.send('closeLoading')
      })
    }).catch(err => {
      console.log(err)
    })
  })
  
  // 删除文件
  ipcMain.on('deleteFile', (event, fileName) => {
    const qiniu = createQiNiu()
    qiniu.deleteFile(fileName + '.md').then(data => {
      console.log('删除文件成功')
    }).catch(err => {
      console.log(err)
    })
  })

  // 重命名
  ipcMain.on('fileRename', (event, oldName, newName) => {
    const qiniu = createQiNiu()
    qiniu.fileRename(oldName + '.md', newName + '.md').then(data => {
      console.log('重命名成功')
    }).catch(err => {
      console.log(err)
    })
  })


  // 下载文件
  ipcMain.on('downloadFile', (event, file) => {
    const fileName = file.fileName
    const path = file.path
    const qiniu = createQiNiu()
    const putTime = file.putTime
    qiniu.getFileInfo(fileName + '.md').then(data => {
      if(data.statusCode !== 612 && (!putTime || Math.round(data.putTime / 10000) > putTime)) {
        mainWindow.webContents.send('changeLoading', '正尝试从云端同步文件到本地')
        qiniu.downloadFile(fileName + '.md', path + '\\' + fileName + '.md').then(() => {
          mainWindow.webContents.send('downloadFile', file.id, Math.round(data.putTime / 10000))
          console.log('下载成功')
        }).catch(err => {
          console.log(err)
          mainWindow.webContents.send('downloadFile', file.id)
        })
      }else {
        mainWindow.webContents.send('downloadFile', file.id)
      }
    }).catch(err => {
      mainWindow.webContents.send('downloadFile', file.id)
    })
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
// app.whenReady().then(createWindow)
app.on('ready', createWindow)

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', function () {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
