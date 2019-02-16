// 已经处理 -- 待解决问题 v-if DOM 中有 click 等事件 删除DOM时 没有清除事件
// 模板渲染使用了 eval 方法
;(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global = global || self, global.Vm = factory());
}(this, function () { 'use strict';
  // 调试变量
  let dev = false
  function log (...arr) {
    dev && console.log.apply(this, arr)
  }
  function dir (...arr) {
    dev && console.dir.apply(this, arr)
  }
  // 渲染事件队列
  let Queue = [];
  // 是否开始执行
  let isStartQueue = false
  // 需要清除的事件
  let fnNames = {}
  let clearEvents = []
  // 记录 element 事件
  function pushClearEvents (element, eventType, fn) {
    clearEvents.push({
      element,
      eventType,
      fn
    })
  }
  // 清除 element 事件
  function initClearEvents () {
    while (clearEvents.length) {
      let obj = clearEvents.shift()
      obj.element.removeEventListener(obj.eventType, obj.fn, false)
    }
  }
  // 开始执行渲染事件队列
  function initQueue () {
    while (!isStartQueue && Queue.length) {
      isStartQueue = true
      let obj = Queue.shift()
      log(obj.param, Queue.length);
      obj.fn.apply(obj._this, obj.param)
      // 最后重置 isStartQueue 状态
      setTimeout(() => {
        isStartQueue = false
      },0)
    }
  }
  // 加入渲染事件队列 开始执行
  function pushQueue (el, _this) {
    Queue.push({
      fn: (el, _this) => {
        Compile (el, _this)
      },
      param: [el, _this],
      _this: _this
    })
    // 开始执行渲染事件队列
    initQueue()
  }
  // 编译模板
  function Compile (el, _this) {
    // 实际DOM移到虚拟DOM
    function node2Fragment(el, _this) {
      // 渲染DOM属性 事件
      function tplBindAttr (el, _data, _this) {
        var attrs = el.attributes
        for (let i = 0; i < attrs.length; i++) {
          const attrName = attrs[i]
          if (/^:/.test(attrName.name)) {
            var _attr = attrName.name.substring(1)
            let text = attrName.value
            // DOM属性
            getAttrTplData(el, _attr, text, _data, _this)
          } else if (/^@/.test(attrName.name)) {
            var _attr = attrName.name.substring(1)
            let text = attrName.value
            // DOM事件
            getEventTplData(el, _attr, text, _data, _this)
          } else if (/^v-for/.test(attrName.name)) {
            var _attr = attrName.name
            let text = attrName.value
            // v-for指令
            getVForTplData(el, _attr, text, _data, _this)
          } else if (/^v-if/.test(attrName.name)) {
            var _attr = attrName.name
            let text = attrName.value
            // v-if指令
            getVIfTplData(el, _attr, text, _data, _this)
          }
        }
      }
      // 处理v-for指令
      function getVForTplData (element, attr, text, _data, _this) {
        // 防止死循环
        element.removeAttribute('v-for')
        let elArr = document.createDocumentFragment()
        let str = JSON.stringify({element, attr, text, _data, _this}, null, 2)
        if (/^\((.+), (.+)\) in (.+)$/.test(text)) {
          let [item, key, arr] = [RegExp.$1, RegExp.$2, RegExp.$3]
          log([item, key, arr], 'v-for');
          let _arr = _data[arr]
          for (let i = 0; i < _arr.length; i++) {
            let el = element.cloneNode(true)
            let __data = {}
            __data[item] = _arr[i];
            __data[key] = i;
            // 递归调用
            tplToHtml_item(el, Object.assign({}, _data, __data), _this)
            // 组合成 NodeList
            elArr.appendChild(el)
          }
        }
        // v-for DOM 替换成 NodeList
        element.parentNode.replaceChild(elArr, element)
      }
      // 处理v-if指令
      function getVIfTplData (element, attr, text, $data, _this) {
        // 防止死循环
        element.removeAttribute('v-if')
        let textContent = ''
        // 模板字符串
        let _text = text.replace(/([^{}]+)/g, '$data.$1')
        // textContent = eval.call($data, _text)
        try {
          textContent = eval(_text)
        } catch (error) {
          textContent = JSON.stringify($data, null, 2) + '--' + _text
        }
        if (!textContent) {
          element.parentNode.removeChild(element)
        }
      }
      // 获取 {{name}} 等值
      function getTextTplData (element, text, $data, _$1) {
        let textContent = ''
        // 正则替换
        // textContent = _this.$data[RegExp.$1]
        let _text = text.replace(/\{\{([^{}]+)\}\}/g, '${$data.$1}')
        // 模板字符串
        // textContent = eval.call($data, '`'+ _text + '`')
        log($data, '`'+ _text + '`');
        try {
          textContent = eval('`'+ _text + '`')
        } catch (error) {
          textContent = JSON.stringify($data, null, 2) + '--' + _text
        }
        element.textContent = textContent
      }
      // 获取 event 事件
      function getEventTplData (element, eventType, text, _data, _this) {
        let methods = _this._methods
        let str = 'fn' + new Date().getTime()
        fnNames[str] = methods[text].bind(_this)
        // 绑定事件
        element.addEventListener(eventType, fnNames[str], false);
        // 记录 element 事件
        pushClearEvents(element, eventType, fnNames[str])
      }
      // 获取 attr 属性等值
      function getAttrTplData (element, attr, text, $data, _this) {
        let textContent = ''
        // 模板字符串
        let _text = text.replace(/([^{}]+)/g, '$data.$1')
        // textContent = eval.call($data, _text)
        try {
          textContent = eval(_text)
        } catch (error) {
          textContent = JSON.stringify($data, null, 2) + '--' + _text
        }
        element.setAttribute(attr, textContent)
      }
      // 数据渲染
      function tplToHtml_arr (els, _data, _this) {
        var reg = /\{\{([^{}]+)\}\}/g;
        for (let i = 0; i < els.length; i++) {
          const element = els[i];
          var text = element.textContent;
          if (element.nodeType == 3 && reg.test(text)) {
            // 渲染 text DOM
            getTextTplData(element, text, _data, RegExp.$1);
          } else if (element.nodeType == 1) {
            // 渲染当前DOM属性
            tplBindAttr(element, _data, _this)
            // 递归
            tplToHtml_arr(element.childNodes, _data, _this)
          }
        }
      }
      function tplToHtml_item (el, _data, _this) {
        var reg = /\{\{([^{}]+)\}\}/g;
        const element = el;
        var text = element.textContent;
        if (element.nodeType == 3 && reg.test(text)) {
          // 渲染 text DOM
          getTextTplData(element, text, _data, RegExp.$1);
        } else if (element.nodeType == 1) {
          // 渲染当前DOM属性
          tplBindAttr(element, _data, _this)
          // 递归
          tplToHtml_arr(element.childNodes, _data, _this)
        }
      }

      if (!_this.$fragment) {
        var fragment,child,els,_data;
        fragment = document.createDocumentFragment()
        // 将原生节点拷贝到fragment
        while (child = el.firstChild) {
          fragment.appendChild(child)
        }
        _this.$tplNode = fragment
      }
      // tpl数据备份
      // 取克隆数据
      let _fragment = _this.$tplNode.cloneNode(true)
      log(1, '$tplNode');
      dir(_fragment.cloneNode(true));

      // tpl DOM 复制备份
      // _el.appendChild(_this.$tplNode.cloneNode(true))
      // 遍历子节点
      els = _fragment.childNodes
      _data = _this._data
      tplToHtml_arr(els, _data, _this)

      return _fragment;
    }
    // 清除旧DOM事件
    initClearEvents()

    _this.$el = typeof el === 'string' ? document.querySelector(el) : el;
    _this.$fragment = node2Fragment(_this.$el, _this);
    setTimeout(() => {
      let conEl = _this.$el
      conEl.innerHTML = ''
      conEl.appendChild(_this.$fragment);
      return _this.$fragment;
    },0);
  }
  // 构造函数
  function Vm (options) {
    this.$options = options || {
      data: {},
      methods: {}
    };
    var data = this._data = this.$options.data || {};
    var _methods = this._methods = this.$options.methods || {};
    var _this = this;

    // 数据劫持
    Object.keys(data).forEach(function (key) {
      _this._proxyData(key);
    });

    // 渲染 改为队列
    // Compile(options.el || document.body, _this)
    pushQueue(options.el || document.body, _this)
  }

  Vm.prototype = {
    _proxyData: function (key, setter, getter) {
      var _this = this;
      setter = setter ||
        Object.defineProperty(_this, key, {
          configurable: false,
          enumerable: true,
          get: function proxyGetter() {
            return _this._data[key];
          },
          set: function proxySetter(newVal) {
            _this._data[key] = newVal;
            // 重新渲染 改为队列
            // Compile(_this.$options.el || document.body, _this)
            pushQueue(_this.$options.el || document.body, _this)
          }
        });
    },
  };

  return Vm;
}));
