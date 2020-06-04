import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSearch, faTimes } from '@fortawesome/free-solid-svg-icons';

const FileSearch = ({title, searchFile}, ref) => {
    const [active, setActive] = useState(false)
    const [searchText, setSearchText] = useState('')
    const textStyle = {textAlign: 'left', padding: '7px 13px'}
    const inputRef = useRef(null)

    useImperativeHandle(ref, () => ({
        closeSearch,
        openSearch
      }));

    // 关闭搜索栏
    const closeSearch = () => {
        setActive(false)
        setSearchText('')
        searchFile('')
    }

    // 开启搜索栏
    const openSearch = () => {
        setActive(true)
    }

    const handleSearchEvent = e => {
        const {keyCode} = e
        if (keyCode === 27) {
            closeSearch()
        }
    }

    useEffect(() => {
        if (active) {
            inputRef.current.focus()
        }
        
    })

    return (
        <div className={'flie-search alert alert-primary m-0 rounded-0'} style={{paddingRight: '0.75rem', paddingLeft: '0.75rem'}}>
            <div className="d-flex justify-content-between align-content-center row" style={{margin: 0}}>
                {active ? 
                <>
                    <input className="form-control col-8" value={searchText} onChange={e => {setSearchText(e.target.value);
                    searchFile(e.target.value)}} 
                           onKeyUp={handleSearchEvent} ref={inputRef}/>
                    <button className="my-button col-3" onClick={closeSearch}>
                        <FontAwesomeIcon icon={faTimes} size="lg"/>
                    </button>
                </> : 
                <>
                    <span className="col-8" style={textStyle}>{title}</span>
                    <button className="my-button col-3" onClick={() => {setActive(true)}}>
                        <FontAwesomeIcon icon={faSearch} size="lg"/>
                    </button>
                </>}            
            </div>
        </div>
    )
}

export default forwardRef(FileSearch)