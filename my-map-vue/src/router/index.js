// 引入
import {createRouter, createWebHistory} from 'vue-router'

// 存储路由
const routes = [
	{
		path:"/",	// 用户访问路径
        component: () => import("../views/index.vue")
	},
    // {
	// 	path:"/MapOper",	// 用户访问路径
    //     component: () => import("../views/control/MousePosition.vue")
	// }

]

const router = createRouter({
    history:createWebHistory(),
    routes

})

export default router