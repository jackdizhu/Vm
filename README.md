# Vm

 * 简单实现 Mvvm 库 实现数据到模版的动态渲染

## V1.0.0

  * 数据劫持 Object.defineProperty 监听数据的 get set
  * 待解决问题 v-if DOM 中有 click 等事件 删除DOM时 没有清除事件
  * 待解决问题 模板渲染使用了 eval 方法

## V1.1.0

  * 已经处理 --  v-if DOM 中有 click 等事件 删除DOM时 没有清除事件
  * 已经处理 -- 循环修改属性 10000+ 次内存快速上升问题
  * 已经处理 -- 模板渲染使用了 eval 方法
  * 待解决问题 v-for DOM 节点替换后 原来子元素的编译还会继续进行 导致报错问题
