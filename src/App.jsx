import CupidV5 from './CupidV5.jsx';
import OpsDashboard from './OpsDashboard.jsx';
import './ops-dashboard.css';

export default function App(){
 if(location.pathname==='/dashboard'||location.pathname==='/ops')return <OpsDashboard/>;
 return <CupidV5/>;
}
