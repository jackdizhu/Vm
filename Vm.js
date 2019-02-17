// 待解决问题 v-for DOM 节点替换后 原来子元素的编译还会继续进行 导致报错问题
// _QueueTime 时间内只执行一次 或者最后一次 (偶尔出现没有后面数据变更没有执行问题)

; (function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
      (global = global || self, global.Vm = factory());
}(this, function () {
  'use strict';
  // 调试变量
  let dev = false

  function log(...arr) {
    dev && console.log.apply(this, arr)
  }

  function err(...arr) {
    dev && console.error.apply(this, arr)
  }

  function dir(...arr) {
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
  function pushClearEvents(element, eventType, fnStr) {
    clearEvents.push({
      element,
      eventType,
      fnStr
    })
  }
  // 清除 element 事件
  function initClearEvents() {
    while (clearEvents.length) {
      let obj = clearEvents.shift()
      obj.element.removeEventListener(obj.eventType, fnNames[obj.fnStr], false)
      // 清空保存的方法 优化内存
      // fnNames[obj.fnStr] = null
      delete fnNames[obj.fnStr]
    }
  }
  // 开始执行渲染事件队列
  function initQueue() {
    // while 事件队列优化 改为 递归
    if (!isStartQueue && Queue.length) {
      let _time = new Date().getTime()
      let obj = Queue.shift()
      // _QueueTime 时间内只执行一次 或者最后一次
      if (_time - obj._this.__initQueueTime > obj._this._QueueTime || Queue.length === 0) {
        isStartQueue = true
        // 记录执行开始时间
        obj._this.__initQueueTime = new Date().getTime()
        obj.fn.apply(obj._this, obj.param)
        // 最后重置 isStartQueue 状态
        setTimeout(() => {
          isStartQueue = false
          initQueue()
        }, 0)
      }
    } else {
      log({
        Queue,
        fnNames,
        clearEvents
      }, Queue.length);
    }
  }
  // 加入渲染事件队列 开始执行
  function pushQueue(el, _this) {
    Queue.push({
      fn: (el, _this) => {
        Compile(el, _this)
      },
      param: [el, _this],
      _this: _this
    })
    // 开始执行渲染事件队列
    initQueue()
  }
  // 编译模板
  function Compile(el, _this) {
    // 实际DOM移到虚拟DOM
    function node2Fragment(el, _this) {
      function stringToBoolean(str) {
        let bool = true
        if (str.toLowerCase() === 'false') {
          bool = false
        } else {
          bool = !!str
        }
        return bool
      }
      // 实现 模板字符串功能 解决内存消耗太大问题
      function evalFn(text, $data, fnName) {
        // 删除 ` 字符串
        text = text.replace(/`/g, '')
        // 递归替换
        function replaceItem(text, $data) {
          let _text = text
          if (/\${([^{}]+)}/g.test(_text) && $data) {
            let str = RegExp.$1
            let arr = str.split('.')
            let item = $data
            for (let i = 1; i < arr.length; i++) {
              item = item[arr[i]];
              // 错误提示
              if (item === void (0)) {
                err($data, `Fn:replaceItem::text:${text}>>str:${str}>>arr[i]:${arr[i]}`);
                break;
              }
            }
            _text = _text.replace('${' + str + '}', item)
            // 递归
            _text = replaceItem(_text, $data, 'evalFn')
          }
          return _text
        }
        let textContent = ''
        // try {
        //   textContent = eval(text)
        // } catch (error) {
        //   textContent = JSON.stringify($data, null, 2) + '--' + text
        // }
        textContent = replaceItem(text, $data)

        // v-if Boolean 值处理
        if (fnName === 'getVIfTplData') {
          textContent = stringToBoolean(textContent)
        }

        return textContent
      }
      // 渲染DOM属性 事件
      function tplBindAttr(el, _data, _this) {
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
      function getVForTplData(element, attr, text, _data, _this) {
        // 防止死循环
        element.removeAttribute('v-for')
        let elArr = document.createDocumentFragment()
        let str = JSON.stringify({
          element,
          attr,
          text,
          _data,
          _this
        }, null, 2)
        if (/^\((.+), (.+)\) in (.+)$/.test(text)) {
          let [item, key, arr] = [RegExp.$1, RegExp.$2, RegExp.$3]
          log([item, key, arr], 'v-for');
          let _arr = _data[arr]
          for (let i = 0; i < _arr.length; i++) {
            let el = element.cloneNode(true)
            let __data = {}
            __data[item] = _arr[i];
            __data[key] = i;
            if (__data[item] !== void (0)) {
              // 递归调用
              tplToHtml_item(el, Object.assign({}, _data, __data), _this)
              // 组合成 NodeList
              elArr.appendChild(el)
            } else {
              err(_data, `Fn:getVForTplData::item:${item}>>key:${key}>>arr:${arr}>>i:${i}`)
            }
          }
        }
        // v-for DOM 替换成 NodeList
        element.parentNode.replaceChild(elArr, element)
      }
      // 处理v-if指令
      function getVIfTplData(element, attr, text, $data, _this) {
        // 防止死循环
        element.removeAttribute('v-if')
        let textContent = ''
        // 模板字符串
        let _text = text.replace(/([^{}]+)/g, '${$data.$1}')
        // textContent = eval.call($data, _text)
        // try {
        //   textContent = eval(_text)
        // } catch (error) {
        //   textContent = JSON.stringify($data, null, 2) + '--' + _text
        // }

        textContent = evalFn(_text, $data, 'getVIfTplData')
        if (!textContent) {
          element.parentNode.removeChild(element)
        }
      }
      // 获取 {{name}} 等值
      function getTextTplData(element, text, $data, _$1) {
        let textContent = ''
        // 正则替换
        // textContent = _this.$data[RegExp.$1]
        let _text = text.replace(/\{\{([^{}]+)\}\}/g, '${$data.$1}')
        // 模板字符串
        // textContent = eval.call($data, '`'+ _text + '`')
        log($data, '`' + _text + '`');
        // try {
        //   textContent = eval('`'+ _text + '`')
        // } catch (error) {
        //   textContent = JSON.stringify($data, null, 2) + '--' + _text
        // }
        textContent = evalFn('`' + _text + '`', $data, 'getTextTplData')
        element.textContent = textContent
      }
      // 获取 event 事件
      function getEventTplData(element, eventType, text, _data, _this) {
        let methods = _this._methods
        let str = 'fn' + new Date().getTime()
        fnNames[str] = methods[text].bind(_this)
        // 绑定事件
        element.addEventListener(eventType, fnNames[str], false);
        // 记录 element 事件
        pushClearEvents(element, eventType, str)
      }
      // 获取 attr 属性等值
      function getAttrTplData(element, attr, text, $data, _this) {
        let textContent = ''
        // 模板字符串
        let _text = text.replace(/([^{}]+)/g, '$data.$1')
        // textContent = eval.call($data, _text)
        // try {
        //   textContent = eval(_text)
        // } catch (error) {
        //   textContent = JSON.stringify($data, null, 2) + '--' + _text
        // }
        textContent = evalFn(_text, $data, 'getAttrTplData')
        element.setAttribute(attr, textContent)
      }
      // 数据渲染
      function tplToHtml_arr(els, _data, _this) {
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

      function tplToHtml_item(el, _data, _this) {
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
        var fragment, child, els, _data;
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
      // 最后重置 isStartQueue 状态 继续 执行队列
      // setTimeout(() => {
      //   // _this.$fragment = null
      //   // 执行队列
      //   isStartQueue = false
      //   initQueue()
      // })
    }, 0);
  }
  // 构造函数
  function Vm(options) {
    this.$options = options || {
      data: {},
      methods: {}
    };
    var data = this._data = this.$options.data || {};
    this._methods = this.$options.methods || {};
    // _QueueTime 时间内 渲染事件队列只执行一次
    this._QueueTime = this.$options._QueueTime || 300;
    this.__initQueueTime = 0
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
