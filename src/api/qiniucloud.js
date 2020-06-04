const QiniuAPI = require('./qiniu')
const path = require('path')
const loadFile = path.join(__dirname, '../md/11.md')
const key = '111.md'
const downloadPath = path.join(__dirname, '../md/' + key)

const qiniuManager = new QiniuAPI()
// qiniuManager.uploadFile(loadFile).then(res => {
//     console.log(res)
// }).catch(err => {
//     console.log(err)
// })
// qiniuManager.generateDownloadLink('11.md').then(res => {
//     console.log(res)
//     return qiniuManager.generateDownloadLink('11.md')
// }).then(res => {
//     console.log(res)
// }).catch(err => {
//     console.log(err)
// })

qiniuManager.downloadFile(key, downloadPath).then(() => {
    console.log('写入成功')
}).catch(err => {
    console.log(err)
})