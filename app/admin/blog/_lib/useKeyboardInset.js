'use client';
import { useEffect,useState } from 'react';
import { observeKeyboard } from '../../../../lib/blog/keyboardViewport.mjs';
// The visual viewport shrinks when iPhone Safari opens its software keyboard.
export function useKeyboardInset(){
 const [inset,setInset]=useState(0);
 useEffect(()=>observeKeyboard(window,document,setInset),[]);return inset;
}
