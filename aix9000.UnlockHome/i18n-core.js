// i18n-core.js

//project/
//├── index.html
//├── lang/
//│   ├── zh-CN.json
//│   ├── en-US.json
//│   ├── ja-JP.json
//│   └── ko-KR.json
//└── js/
//    └── i18n.js


class I18nCore {
    constructor() {
        this.translations = new Map();
        this.observers = new Set();
        // 等待 DOM 加载完成后再初始化
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initMutationObserver());
        } else {
            this.initMutationObserver();
        }
    }

    // 初始化DOM变化观察器
    initMutationObserver() {
        // 确保 document.body 存在
        if (!document.body) {
            setTimeout(() => this.initMutationObserver(), 10);
            return;
        }

        const observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1) { // 元素节点
                        this.translateNewNode(node);
                    }
                });
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // 翻译新添加的节点
    translateNewNode(node) {
        if (node.hasAttribute && node.hasAttribute('key')) {
            this.translateElement(node);
        }

        if (node.querySelectorAll) {
            node.querySelectorAll('[key]').forEach(el => {
                this.translateElement(el);
            });
        }
    }

    // 翻译单个元素
    translateElement(element) {
        const key = element.getAttribute('key');

        // 获取参数
        let params = {};
        const paramsStr = element.getAttribute('data-params');
        if (paramsStr) {
            try {
                params = JSON.parse(paramsStr);
            } catch (e) {
                console.warn('参数解析失败:', e);
            }
        }

        const translation = this.getTranslation(key, params);

        if (translation) {
            // 处理不同类型的元素
            const tagName = element.tagName;

            if (tagName === 'INPUT' || tagName === 'TEXTAREA') {
                if (element.hasAttribute('placeholder')) {
                    element.placeholder = translation;
                } else {
                    element.value = translation;
                }
            } else if (tagName === 'IMG') {
                element.alt = translation;
            } else if (tagName === 'TITLE') {
                document.title = translation;
            } else {
                element.innerHTML = translation;
            }
        }
    }

    // 获取翻译
    getTranslation(key, params = {}) {
        let translation = this.translations.get(key);

        // 如果没有找到翻译，返回 key 作为默认值
        if (translation === undefined) {
            console.warn(`翻译key不存在: ${key}`);
            return key;
        }

        // 替换参数
        Object.keys(params).forEach(param => {
            translation = translation.replace(`{{${param}}}`, params[param]);
        });

        return translation;
    }

    // 加载翻译数据
    async loadTranslations() {
        const browserLang = navigator.language || navigator.userLanguage;
        console.log('浏览器语言:', browserLang); 
        // 映射到支持的语言
        let lang = 'zh-CN'; // 默认中文 
        if (browserLang.startsWith('en')) {
            lang = 'en-US';
        } else if (browserLang.startsWith('ja')) {
            lang = 'ja-JP';
        } else if (browserLang.startsWith('ko')) {
            lang = 'ko-KR';
        }
        try {
            // 使用相对路径，指向当前目录下的 lang 文件夹
            let response = null
            try {
                response = await fetch(`lang/${lang}.json`);
                if (!response.ok) { 
                    throw new Error(`本地翻译不存在..... ${response.status}`);
                }
            } catch (error) {
                lang = 'en-US'
                response = await fetch(`lang/${lang}.json`);
                if (!response.ok) {
                    throw new Error(`英文翻译也不存在.....: ${response.status}`);
                }
            }
            const data = await response.json();
            this.translations.clear();
            this.flattenTranslations(data, '');
            this.notifyObservers();

            // 重新翻译所有元素
            document.querySelectorAll('[key]').forEach(el => this.translateElement(el));

            console.log(`翻译加载成功: ${lang}`);
        } catch (error) {
            console.error('加载翻译失败:', error);

            // 如果加载失败，尝试加载默认语言
            if (lang !== 'zh-CN') {
                console.log('尝试加载默认语言 zh-CN');
                await this.loadTranslations('zh-CN');
            }
        }
    }

    // 扁平化翻译对象
    flattenTranslations(obj, prefix = '') {
        Object.keys(obj).forEach(key => {
            const fullKey = prefix ? `${prefix}.${key}` : key;
            if (obj[key] && typeof obj[key] === 'object') {
                this.flattenTranslations(obj[key], fullKey);
            } else {
                this.translations.set(fullKey, obj[key]);
            }
        });
    }

    // 观察者模式
    addObserver(callback) {
        this.observers.add(callback);
    }

    notifyObservers() {
        this.observers.forEach(callback => callback());
    }
}

// 创建全局实例
const i18n = new I18nCore();