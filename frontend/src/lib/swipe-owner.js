// Ownership follows the operation that needs horizontal movement, not whether
// an element is clickable. A button, calendar day or muscle map still belongs
// to page navigation once movement becomes a deliberate horizontal swipe.
const editing='textarea,select,input:not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="checkbox"]):not([type="radio"]):not([type="hidden"]),[contenteditable]:not([contenteditable="false"]),[role="combobox"],[role="spinbutton"]'
const horizontal='[role="slider"],.sld,.bodyweight-picker-ruler,.chart-i,.swipe-content,.stats-sections-trigger,[data-swipe-owner="horizontal"],[data-swipe-owner="both"]'
const reserved='[draggable="true"],video[controls],audio[controls],iframe,dialog,[role="dialog"],[aria-modal="true"],[data-swipe-ignore],[inert],[hidden],[data-app-pane][aria-hidden="true"]'

export const isSwipeEditingTarget=target=>!!target?.matches?.(editing)

export function horizontalGestureOwner(target,boundary) {
  for(let node=target?.nodeType===1?target:target?.parentElement;node;node=node.parentElement){
    if(node.matches?.(editing+','+horizontal+','+reserved))return node
    // Native scroll surfaces retain their gesture even at either end. A
    // nonoverflowing table/container has no horizontal operation to reserve.
    if(node.clientWidth>0&&node.scrollWidth>node.clientWidth+2&&/(auto|scroll)/.test(getComputedStyle(node).overflowX))return node
    if(node===boundary)break
  }
  return null
}
