// Always returns a payload, so the prerendered HTML shows exactly what <Negotiate /> renders.
export const load = () => ({ title: 'Rendered', __negotiate: 'before </script> after' });
