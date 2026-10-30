import { useUI } from '../store/useUI.js'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import { STATS_PAGES, activeStatsPage, statsPageTarget } from '../lib/navigation-model.js'
import { StatsCustomizationPanel } from './StatsSections.jsx'
import Icon from './Icon.jsx'

const items={
 home:[['Training','/home#training-top','house'],['Training Calendar','/home#training-calendar','calendar'],['Summary','/home#training-summary','chart'],['Body Weight','/home#training-bodyweight','scale'],['Consistency','/home#training-consistency','flame'],['Settings','/settings','gear']],
 plan:[['Week & routines','/plan','calendar'],['Exercises','/library','dumbbell']],
 nutrition:[['Nutrition','/nutrition#nutrition-top','fork'],['Calendar','/nutrition#nutrition-calendar','calendar'],['Calories','/nutrition#nutrition-calories','chart'],['Macros','/nutrition#nutrition-macros','chart'],['Water','/nutrition#nutrition-water','drop'],['Breakfast','/nutrition#nutrition-breakfast','fork'],['Lunch','/nutrition#nutrition-lunch','fork'],['Dinner','/nutrition#nutrition-dinner','fork'],['Snack','/nutrition#nutrition-snack','fork']],
}
export function moduleMenuItems(module){return items[module]||STATS_PAGES.map(([id,label])=>[label,statsPageTarget(id),'chart'])}
export function openModuleMenu(module,label,current,navigate,onClose){
 const location=new URL(current,'https://tgym.invalid')
 return useUI.getState().openSheet(close=>module==='stats'?<StatsCustomizationPanel sheet close={close} activeId={activeStatsPage(useStore.getState().S,location)} onSelect={id=>navigate(statsPageTarget(id))}/>:<div className="module-jump-menu" id={'module-menu-'+module} data-nodrag><h2>{t(label)}</h2>{moduleMenuItems(module).map(([name,to,icon])=><button type="button" className="module-jump-option" key={to} aria-current={current===to?'page':undefined} onClick={()=>{close();navigate(to)}}><Icon name={icon}/><span>{t(name)}</span><Icon name="chevronRight"/></button>)}</div>,{onClose})
}
