window.__ModuleLoader__.load({ id: 'dsh-recovery-center', factory: require => {
  const React = require('react');
  return {
    name: 'dsh-recovery-center', inject: ['slots', 'locale'],
    apply(ctx) {
      ctx.effect(() => ctx.locale.register('recoveryCenter', {
        zh: { title: '恢复中心' }, en: { title: 'Recovery Center' },
      }), 'recovery-center: translations');
      const t = ctx.locale.bind('recoveryCenter');
      const current = () => /^zh(?:[-_]|$)/i.test(ctx.locale.getSnapshot().active) ? 'zh' : 'en';
      function Panel() {
        const lang = React.useSyncExternalStore(fn => ctx.locale.subscribe(fn), current);
        const frame = React.useRef(null);
        const initial = React.useRef(lang);
        const sync = () => frame.current?.contentWindow?.postMessage({type:'dsh-recovery-locale',lang}, window.location.origin);
        React.useEffect(sync, [lang]);
        return React.createElement('iframe', {
          ref:frame, src:'/dsh-recovery/?lang='+initial.current, onLoad:sync, title:t('title'),
          style:{width:'100%',height:'min(760px, 80vh)',minHeight:'480px',border:0,borderRadius:'14px'},
        });
      }
      ctx.slots.inject('settings.section', () => ctx.slots.register({
        name:'settings.section',id:'recovery-center',order:110,label:()=>t('title'),
      }, Panel));
    },
  };
}});
