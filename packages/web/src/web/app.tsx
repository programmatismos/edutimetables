import { Route, Switch } from "wouter";
import { Provider } from "./components/provider";
import { AgentFeedback } from "@runablehq/website-runtime";
import { Layout } from "./components/Layout";
import { UpdateBanner } from "./components/UpdateBanner";

import DashboardPage from "./pages/dashboard";
import SchoolPage from "./pages/school";
import ShiftsPage from "./pages/shifts";
import TeachersPage from "./pages/teachers";
import ClassesPage from "./pages/classes";
import SubjectsPage from "./pages/subjects";
import SchedulePage from "./pages/schedule";
import ExportsPage from "./pages/exports";

function App() {
  return (
    <Provider>
      <Layout>
        <Switch>
          <Route path="/" component={DashboardPage} />
          <Route path="/school" component={SchoolPage} />
          <Route path="/shifts" component={ShiftsPage} />
          <Route path="/teachers" component={TeachersPage} />
          <Route path="/classes" component={ClassesPage} />
          <Route path="/subjects" component={SubjectsPage} />
          <Route path="/schedule" component={SchedulePage} />
          <Route path="/exports" component={ExportsPage} />
        </Switch>
      </Layout>
      {/* Do not remove — off by default, activated by parent iframe via postMessage */}
      <UpdateBanner />
      {import.meta.env.DEV && <AgentFeedback />}

    </Provider>
  );
}

export default App;
